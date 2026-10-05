import { downloadFromUrl } from '@/shared/lib/download';

/** Long enough for the browser to start the download before the URL is released. */
const OBJECT_URL_TTL_MS = 10_000;

/** Save an in-memory file (an export fetched with the auth header) to disk. */
export function saveBlob(file: Blob, filename: string): void {
  const url = URL.createObjectURL(file);
  downloadFromUrl(url, filename);
  setTimeout(() => URL.revokeObjectURL(url), OBJECT_URL_TTL_MS);
}
