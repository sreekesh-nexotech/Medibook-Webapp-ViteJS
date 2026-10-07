import { z } from 'zod';

import type { SignedFileUrl, StoredFile } from '@/core/api/files.types';

/** `files.serialize()` in the backend (`documents/services/files.py`). */
export const storedFileResponseSchema = z.object({
  id: z.string(),
  purpose: z.string(),
  owner_kind: z.enum(['patient', 'hospital', 'platform']),
  hospital_id: z.string().nullable(),
  original_name: z.string(),
  mime: z.string(),
  size_bytes: z.number().int(),
  sha256: z.string().nullable(),
  status: z.enum(['pending', 'uploaded', 'scanning', 'clean', 'infected', 'sealed', 'scan_failed']),
  uploaded_at: z.string().nullable(),
  scanned_at: z.string().nullable(),
  expires_at: z.string().nullable(),
  created_at: z.string(),
  version: z.number().int(),
});

/**
 * `POST /shared/files/uploads` → 201: the pending row plus a presigned PUT
 * (start it within 2 minutes) and the headers — including
 * `x-amz-checksum-sha256` — the PUT must send verbatim (B6).
 */
export const uploadTicketResponseSchema = z.object({
  file_id: z.string(),
  upload_url: z.string().min(1),
  method: z.literal('PUT'),
  headers: z.record(z.string(), z.string()),
  expires_at: z.string(),
  file: storedFileResponseSchema,
});

/** `GET /shared/files/{id}/url` → a 10-minute signed GET. */
export const signedUrlResponseSchema = z.object({
  url: z.string().min(1),
  expires_at: z.string(),
});

export type StoredFileResponse = z.infer<typeof storedFileResponseSchema>;
export type UploadTicketResponse = z.infer<typeof uploadTicketResponseSchema>;
export type SignedUrlResponse = z.infer<typeof signedUrlResponseSchema>;

export function toStoredFile(dto: StoredFileResponse): StoredFile {
  return {
    id: dto.id,
    purpose: dto.purpose,
    ownerKind: dto.owner_kind,
    hospitalId: dto.hospital_id,
    originalName: dto.original_name,
    mime: dto.mime,
    sizeBytes: dto.size_bytes,
    sha256: dto.sha256,
    status: dto.status,
    uploadedAt: dto.uploaded_at,
    scannedAt: dto.scanned_at,
    expiresAt: dto.expires_at,
    createdAt: dto.created_at,
    version: dto.version,
  };
}

export function toSignedFileUrl(dto: SignedUrlResponse): SignedFileUrl {
  return { url: dto.url, expiresAt: dto.expires_at };
}
