/**
 * Date display for the ops hospital registry and profile, read off the local
 * calendar (never `toISOString()`, which shifts local-midnight dates back a
 * day east of UTC).
 */

/** Long month names, matching the registry's "June 13, 2026" display format. */
const MONTHS_LONG = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** A `Date` as "June 13, 2026", from its local calendar fields. */
function longDate(d: Date): string {
  return `${MONTHS_LONG[d.getMonth()]} ${pad2(d.getDate())}, ${d.getFullYear()}`;
}

/** A moment in the console's stamp format, e.g. "October 05, 2026 · 14:32". */
export function opsStampFrom(ms: number): string {
  const d = new Date(ms);
  return `${longDate(d)} · ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** A backend ISO timestamp as a long local date ("June 13, 2026"); `null` gives an em dash. */
export function longDateFromTimestamp(ts: string | null | undefined): string {
  if (!ts) return '—';
  const ms = Date.parse(ts);
  return Number.isNaN(ms) ? '—' : longDate(new Date(ms));
}
