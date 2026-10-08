/**
 * The one local clock every trail-stamped action reads.
 *
 * Dates in this app are **local-calendar** values. `new Date().toISOString()`
 * on a local-midnight Date shifts the day backwards for every user east of
 * UTC — the root cause of the app's yesterday-date defect — so every ISO
 * string here is assembled from `getFullYear()/getMonth()/getDate()` and
 * nothing in these helpers ever calls `toISOString()`.
 *
 * Pure functions, no React and no store: safe to call from any layer.
 */

/** Zero-pad a date/time part to two digits. */
function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Local calendar date as `yyyy-mm-dd`. */
export function localDateIso(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Local wall-clock time as 24h `HH:MM`. */
export function localTimeHm(d: Date = new Date()): string {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** Weekday index of an ISO date, 0 = Monday … 6 = Sunday. */
export function isoWeekdayIndex(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  const at = new Date(y, (m ?? 1) - 1, d ?? 1, 12, 0, 0, 0);
  return (at.getDay() + 6) % 7;
}
