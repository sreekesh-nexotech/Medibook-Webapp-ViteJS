/**
 * Stored-file entities for the shared files API (`/api/v1/shared/files/*`).
 * Plain readonly types — no Zod, no Axios (those live in `files.response.ts`
 * and `files.api.ts`).
 */

/**
 * Lifecycle (backend `documents.models.File.Status`); only `clean` files may be
 * attached. `failed` marks an async export whose build failed (B7, L-37).
 */
export type FileStatus =
  'pending' | 'uploaded' | 'scanning' | 'clean' | 'infected' | 'sealed' | 'scan_failed' | 'failed';

/** What a file is for — decides who may upload it and which types are allowed. */
export type FilePurpose =
  'logo' | 'stamp' | 'cover' | 'doctor_photo' | 'banner' | 'kyc' | 'ticket_attachment';

export type FileOwnerKind = 'patient' | 'hospital' | 'platform';

/** Metadata of one stored file (never the storage key or bucket). */
export interface StoredFile {
  readonly id: string;
  readonly purpose: string;
  readonly ownerKind: FileOwnerKind;
  readonly hospitalId: string | null;
  readonly originalName: string;
  readonly mime: string;
  readonly sizeBytes: number;
  readonly sha256: string | null;
  readonly status: FileStatus;
  readonly uploadedAt: string | null;
  readonly scannedAt: string | null;
  readonly expiresAt: string | null;
  readonly createdAt: string;
  /** Row version, for `If-Match` on delete. */
  readonly version: number;
}

/** A short-lived signed download link. */
export interface SignedFileUrl {
  readonly url: string;
  readonly expiresAt: string;
}

/** Everything needed to upload one file. */
export interface FileUploadInput {
  readonly file: File;
  readonly purpose: FilePurpose;
  /** Only for a hospital principal uploading on behalf of its own hospital. */
  readonly hospitalId?: string;
}
