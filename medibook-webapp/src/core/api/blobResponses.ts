import { isAxiosError } from 'axios';
import { z } from 'zod';

/**
 * Helpers for requests made with `responseType: 'blob'` (file exports and
 * PDFs).
 *
 * - Their error bodies arrive as a `Blob` too, so `toFailure` cannot read the
 *   backend's `{code, message}` envelope. `withJsonErrorBody` decodes it back
 *   to JSON in place, so a 403 or 501 keeps its own message.
 * - A server-built export that stopped at its row cap says so in a header
 *   (`X-Export-Truncated: true`, with `X-Export-Row-Count`); `exportTruncation`
 *   reads them.
 * - A PDF route may answer with the bytes, or with JSON `{url}` pointing at
 *   the stored file (backend SET-02); `readFileOrUrl` tells them apart.
 */

/**
 * Decode a blob request's JSON error body in place; a body that is not JSON
 * (a proxy's HTML page) is left as it was and maps by status alone.
 */
export async function withJsonErrorBody(error: unknown): Promise<unknown> {
  if (isAxiosError(error) && error.response?.data instanceof Blob) {
    try {
      error.response.data = JSON.parse(await error.response.data.text());
    } catch {
      // Not JSON: toFailure maps it by status alone.
    }
  }
  return error;
}

/** Header a server-built export sets when it stopped at its row cap. */
export const EXPORT_TRUNCATED_HEADER = 'x-export-truncated';

/** Header carrying how many rows the file holds — the cap, when truncated (backend B3). */
export const EXPORT_ROW_COUNT_HEADER = 'x-export-row-count';

/** Older name for the same figure. */
export const EXPORT_ROW_LIMIT_HEADER = 'x-export-row-limit';

const FALSE_VALUES: ReadonlySet<string> = new Set(['', '0', 'false', 'no']);

/** What an export's headers say about rows left out. */
export interface ExportTruncation {
  readonly truncated: boolean;
  /** The row cap, when the server said what it was. */
  readonly rowLimit: number | null;
}

function headerValue(headers: unknown, name: string): string | null {
  if (typeof headers !== 'object' || headers === null) return null;
  const record = headers as Record<string, unknown>;
  const direct = record[name];
  if (typeof direct === 'string') return direct;
  const match = Object.keys(record).find((k) => k.toLowerCase() === name);
  const value = match === undefined ? undefined : record[match];
  return typeof value === 'string' ? value : null;
}

/**
 * Read the truncation signal from response headers. The header's value is
 * either a flag (`true`) or the row cap (`10000`); both mean "truncated".
 */
export function exportTruncation(headers: unknown): ExportTruncation {
  const flag = headerValue(headers, EXPORT_TRUNCATED_HEADER);
  const truncated = flag !== null && !FALSE_VALUES.has(flag.trim().toLowerCase());
  if (!truncated) return { truncated, rowLimit: null };
  const explicit = Number(
    headerValue(headers, EXPORT_ROW_COUNT_HEADER) ??
      headerValue(headers, EXPORT_ROW_LIMIT_HEADER) ??
      '',
  );
  // A flag of `1` means "yes"; a larger number is the cap itself.
  const fromFlag = Number(flag);
  const limit = Number.isInteger(explicit) && explicit > 0 ? explicit : fromFlag;
  return { truncated, rowLimit: Number.isInteger(limit) && limit > 1 ? limit : null };
}

const signedLinkSchema = z.object({ url: z.string().min(1) });

const JSON_MIME = 'application/json';

/** A PDF route's answer: the file itself, or a link to the stored file. */
export type FileOrUrl =
  { readonly kind: 'file'; readonly blob: Blob } | { readonly kind: 'url'; readonly url: string };

/**
 * Tell a PDF body from a JSON `{url}` answer. Followed redirects already
 * arrive as the PDF's bytes, so only a JSON body needs reading.
 */
export async function readFileOrUrl(blob: Blob): Promise<FileOrUrl> {
  if (!blob.type.toLowerCase().startsWith(JSON_MIME)) return { kind: 'file', blob };
  const parsed = signedLinkSchema.parse(JSON.parse(await blob.text()));
  return { kind: 'url', url: parsed.url };
}
