import axios from 'axios';

import { isFileStoreUrl } from '@/core/api/fileUrls';
import { ifMatch } from '@/core/api/headers';
import { sharedApi } from '@/core/api/http';
import { activeSurface } from '@/core/api/surface';
import { FILE_UPLOAD_MAX_BYTES, FILE_UPLOAD_RULES, normaliseMime } from '@/core/api/files.rules';
import {
  signedUrlResponseSchema,
  storedFileResponseSchema,
  toSignedFileUrl,
  toStoredFile,
  uploadTicketResponseSchema,
} from '@/core/api/files.response';
import type { FileUploadInput, SignedFileUrl, StoredFile } from '@/core/api/files.types';
import { attempt } from '@/core/error/attempt';
import type { Failure, Result } from '@/core/error/failure';
import { err } from '@/core/error/failure';
import { clientFailure } from '@/core/error/toFailure';

/**
 * Shared files API (`/api/v1/shared/files/*`) — the three-step upload, signed
 * downloads, metadata and soft delete. Every function returns a `Result`; the
 * token is the active surface's (see `sharedApi`).
 */

/**
 * The presigned PUT must *start* within 2 minutes (B6, M-38); the transfer
 * itself may take longer on a slow line, so allow it 5.
 */
const STORAGE_PUT_TIMEOUT_MS = 5 * 60_000;

const BYTES_PER_MB = 1024 * 1024;

const SHA256_ALGORITHM = 'SHA-256';
const HEX_RADIX = 16;
const HEX_BYTE_WIDTH = 2;

/** Hex SHA-256 of the file, or `null` where WebCrypto is unavailable (non-secure origin). */
async function sha256Hex(file: File): Promise<string | null> {
  if (typeof crypto === 'undefined' || !crypto.subtle) return null;
  const digest = await crypto.subtle.digest(SHA256_ALGORITHM, await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), (b) =>
    b.toString(HEX_RADIX).padStart(HEX_BYTE_WIDTH, '0'),
  ).join('');
}

/** Refuse what the server certainly would, before any request is made. */
function checkUpload(input: FileUploadInput, mime: string): Failure | null {
  const rule = FILE_UPLOAD_RULES[input.purpose];
  if (!rule.surfaces.includes(activeSurface())) {
    return clientFailure('forbidden', 'You cannot upload this kind of file here.');
  }
  if (!rule.mimes.includes(mime)) {
    return clientFailure('validation', 'This file type is not allowed.', 'FILE_TYPE_NOT_ALLOWED');
  }
  if (input.file.size <= 0) {
    return clientFailure('validation', 'This file is empty.');
  }
  if (input.file.size > FILE_UPLOAD_MAX_BYTES) {
    const limitMb = FILE_UPLOAD_MAX_BYTES / BYTES_PER_MB;
    return clientFailure('validation', `Files can be at most ${limitMb} MB.`, 'FILE_TOO_LARGE');
  }
  return null;
}

/** Shown when the presigned upload link cannot be reached. */
const STORAGE_UNREACHABLE =
  'The file could not be sent to file storage, so it was not uploaded. The Medibook server is reachable — its file storage is not. Ask your administrator to check the storage setup.';

/**
 * Upload one file end to end:
 * 1. `POST /files/uploads` — create the pending row, get a presigned PUT;
 * 2. `PUT` the bytes straight to object storage (no bearer token — the URL is
 *    the credential);
 * 3. `POST /files/{id}/complete` — the server verifies size/sha256 and starts
 *    the virus scan.
 *
 * Resolves to the file in `scanning` status; it becomes attachable once
 * `status === 'clean'` (poll with `getFile`).
 */
export async function uploadFile(input: FileUploadInput): Promise<Result<StoredFile>> {
  const mime = normaliseMime(input.file.type);
  const refused = checkUpload(input, mime);
  if (refused) return err(refused);

  return attempt(async () => {
    // The server requires the checksum and storage verifies the bytes
    // against it (B6, M-38); WebCrypto exists only on secure origins.
    const sha256 = await sha256Hex(input.file);
    if (sha256 === null) {
      throw clientFailure(
        'validation',
        'Files can only be uploaded over a secure (https) connection.',
        'INSECURE_ORIGIN',
      );
    }
    const created = await sharedApi.post('/files/uploads', {
      purpose: input.purpose,
      mime,
      size_bytes: input.file.size,
      original_name: input.file.name,
      sha256,
      ...(input.hospitalId ? { hospital_id: input.hospitalId } : {}),
    });
    const ticket = uploadTicketResponseSchema.parse(created.data);
    if (!isFileStoreUrl(ticket.upload_url)) {
      throw clientFailure(
        'forbidden',
        'The upload link does not point to the file store, so the file was not sent.',
      );
    }

    try {
      await axios.put(ticket.upload_url, input.file, {
        headers: ticket.headers,
        timeout: STORAGE_PUT_TIMEOUT_MS,
      });
    } catch (error) {
      // No answer at all means the storage host itself is unreachable (e.g.
      // the test backend's fake store, BACKEND_BLOCKERS ENV-02) — not the API,
      // which just answered step 1. Say so rather than "check your connection".
      if (axios.isAxiosError(error) && !error.response) {
        throw clientFailure('network', STORAGE_UNREACHABLE, 'STORAGE_UNREACHABLE');
      }
      throw error;
    }

    const completed = await sharedApi.post(`/files/${encodeURIComponent(ticket.file_id)}/complete`);
    return toStoredFile(storedFileResponseSchema.parse(completed.data));
  });
}

/** `GET /files/{id}` — metadata (e.g. to watch the scan status). */
export function getFile(fileId: string): Promise<Result<StoredFile>> {
  return attempt(async () => {
    const response = await sharedApi.get(`/files/${encodeURIComponent(fileId)}`);
    return toStoredFile(storedFileResponseSchema.parse(response.data));
  });
}

/** `GET /files/{id}/url` — a 10-minute signed download link. */
export function getFileUrl(fileId: string): Promise<Result<SignedFileUrl>> {
  return attempt(async () => {
    const response = await sharedApi.get(`/files/${encodeURIComponent(fileId)}/url`);
    const signed = toSignedFileUrl(signedUrlResponseSchema.parse(response.data));
    if (!isFileStoreUrl(signed.url)) {
      throw clientFailure(
        'forbidden',
        'This file link does not point to the file store, so it was not opened.',
      );
    }
    return signed;
  });
}

/**
 * `DELETE /files/{id}` — soft delete. Pass the `version` you read to guard
 * against a concurrent change. Fails with `conflict` / `FILE_IN_USE` while a
 * record still references the file.
 */
export function deleteFile(fileId: string, version?: number): Promise<Result<null>> {
  return attempt(async () => {
    await sharedApi.delete(`/files/${encodeURIComponent(fileId)}`, {
      headers: version === undefined ? undefined : ifMatch(version),
    });
    return null;
  });
}
