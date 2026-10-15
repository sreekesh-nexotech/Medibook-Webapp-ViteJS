import { calendarDate, calendarTimeHm } from '@/shared/lib/format';

/**
 * Date display for the ops hospital registry and profile, in India Standard
 * Time whatever the device is set to (never `toISOString()`, which gives the
 * UTC day).
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

/** A moment's date as "June 13, 2026". */
function longDate(ms: number): string {
  const [y, m, d] = calendarDate(ms).split('-');
  return `${MONTHS_LONG[Number(m) - 1]} ${d}, ${y}`;
}

/** A moment in the console's stamp format, e.g. "October 05, 2026 · 14:32". */
export function opsStampFrom(ms: number): string {
  return `${longDate(ms)} · ${calendarTimeHm(ms)}`;
}

/** A backend ISO timestamp as a long local date ("June 13, 2026"); `null` gives an em dash. */
export function longDateFromTimestamp(ts: string | null | undefined): string {
  if (!ts) return '—';
  const ms = Date.parse(ts);
  return Number.isNaN(ms) ? '—' : longDate(ms);
}
