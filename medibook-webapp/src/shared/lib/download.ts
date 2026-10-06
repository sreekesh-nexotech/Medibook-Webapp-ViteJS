/**
 * Real client-side file downloads — audit 3.1.4 ("every PDF download is a
 * message, not a file"). A control wired to these functions actually puts a
 * file on the user's disk, so it may legitimately claim success.
 *
 * Generalised from the two working CSV exporters already in the app
 * (`PaymentsScreen.exportCsv`, `SettlementsScreen.exportCsv`), with three
 * fixes those copies do not have: embedded quotes are escaped instead of
 * producing a broken cell, a UTF-8 BOM is prepended so Excel renders the
 * rupee sign, and the object URL is revoked once the click is dispatched.
 *
 * No React, no stores — safe to call from any event handler.
 */

/** Excel only reads a UTF-8 CSV correctly when it starts with a BOM. */
const UTF8_BOM = '﻿';

/** Cells are CRLF-terminated: the line ending every spreadsheet agrees on. */
const CSV_ROW_SEPARATOR = '\r\n';

const CSV_MIME = 'text/csv;charset=utf-8';

/** Give the browser a tick to start the transfer before revoking the URL. */
const REVOKE_DELAY_MS = 1000;

/** One CSV cell as a screen can hand it over. */
export type CsvCell = string | number | null | undefined;

/** Spreadsheet apps run a cell that starts with one of these as a formula. */
const FORMULA_PREFIX = /^[=+\-@\t\r]/;
/** A plain number cannot run anything, so it stays a number in the spreadsheet. */
const PLAIN_NUMBER = /^[+-]?\d+(\.\d+)?$/;

/**
 * Neutralise spreadsheet formula injection the way the backend's own exports
 * do (`settlements/services/export.py`): text a spreadsheet would run as a
 * formula gets a leading apostrophe, so it opens as plain text.
 */
export function neutraliseFormula(text: string): string {
  return FORMULA_PREFIX.test(text) && !PLAIN_NUMBER.test(text) ? `'${text}` : text;
}

/**
 * RFC-4180 cell: empty for nullish, always quoted, embedded `"` doubled.
 * Quoting unconditionally means commas, newlines and leading zeros survive.
 * Text cells are formula-neutralised (PHI-04); numbers are written as they are.
 */
function csvCell(cell: CsvCell): string {
  if (cell == null) return '""';
  const text = typeof cell === 'string' ? neutraliseFormula(cell) : String(cell);
  return `"${text.replace(/"/g, '""')}"`;
}

/** Serialise rows to an RFC-4180 CSV body (no BOM — `downloadCsv` adds it). */
export function toCsv(rows: readonly (readonly CsvCell[])[]): string {
  return rows.map((row) => row.map(csvCell).join(',')).join(CSV_ROW_SEPARATOR);
}

/**
 * Download `text` as a file. The underlying primitive: builds a Blob, clicks a
 * detached anchor, then revokes the object URL so the blob is not retained for
 * the life of the tab.
 */
export function downloadTextFile(filename: string, text: string, mime = 'text/plain'): void {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS);
}

/**
 * Download `rows` as a real CSV file — pass the header row first:
 *
 * ```ts
 * downloadCsv('medibook-payments.csv', [
 *   ['Patient', 'MR Number', 'Amount'],
 *   ...rows.map((r) => [r.name, r.mrn, r.amount]),
 * ]);
 * ```
 */
export function downloadCsv(filename: string, rows: readonly (readonly CsvCell[])[]): void {
  downloadTextFile(filename, UTF8_BOM + toCsv(rows), CSV_MIME);
}

/**
 * Download from a URL the browser can fetch directly — e.g. a signed storage
 * link from `GET /shared/files/{id}/url`, whose response already carries
 * `Content-Disposition: attachment`. `filename` is a hint only: browsers
 * ignore `download` on cross-origin links and use the server's name.
 */
export function downloadFromUrl(url: string, filename?: string): void {
  const a = document.createElement('a');
  a.href = url;
  if (filename) a.download = filename;
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
}
