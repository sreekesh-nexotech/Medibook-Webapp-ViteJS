import type { ApiSurface } from '@/core/api/surface';
import type { FilePurpose } from '@/core/api/files.types';

/**
 * Client-side mirror of the backend's upload rules (`documents/services/files.py`
 * `UPLOAD_RULES`, `upload_max_bytes`), so a wrong type or an oversized file is
 * refused before any request. The server re-checks everything; these only
 * save a round trip and give a clearer message.
 */

const PDF = 'application/pdf';
const JPEG = 'image/jpeg';
const PNG = 'image/png';
const WEBP = 'image/webp';

const IMAGE_MIMES = [JPEG, PNG, WEBP] as const;
const DOCUMENT_MIMES = [PDF, JPEG, PNG] as const;

interface UploadRule {
  readonly surfaces: readonly ApiSurface[];
  readonly mimes: readonly string[];
}

export const FILE_UPLOAD_RULES: Readonly<Record<FilePurpose, UploadRule>> = {
  logo: { surfaces: ['hospital'], mimes: IMAGE_MIMES },
  stamp: { surfaces: ['hospital'], mimes: IMAGE_MIMES },
  cover: { surfaces: ['hospital'], mimes: IMAGE_MIMES },
  doctor_photo: { surfaces: ['hospital'], mimes: IMAGE_MIMES },
  banner: { surfaces: ['hospital', 'platform'], mimes: IMAGE_MIMES },
  kyc: { surfaces: ['platform'], mimes: DOCUMENT_MIMES },
  ticket_attachment: { surfaces: ['hospital', 'platform'], mimes: DOCUMENT_MIMES },
};

/**
 * Default upload ceiling (Q117: 10 MB). The platform can configure a
 * different value server-side; the server's `FILE_TOO_LARGE` answer is final.
 */
export const FILE_UPLOAD_MAX_BYTES = 10 * 1024 * 1024;

/** Browsers report JPEGs as `image/jpg` occasionally; the backend normalises the same way. */
export function normaliseMime(mime: string): string {
  const lower = mime.toLowerCase().trim();
  return lower === 'image/jpg' ? JPEG : lower;
}

/** Comma-joined MIME list for an `<input type="file" accept>` attribute. */
export function acceptFor(purpose: FilePurpose): string {
  return FILE_UPLOAD_RULES[purpose].mimes.join(',');
}
