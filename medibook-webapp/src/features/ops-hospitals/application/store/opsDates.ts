/**
 * Local-calendar date helpers for the ops console. Pure, no React, no stores.
 *
 * Every ISO string here is assembled from `getFullYear()` / `getMonth()` /
 * `getDate()` — **never** `toISOString()` on a local-midnight `Date`, which
 * shifts the day backwards in every timezone west of UTC and is the root cause
 * of the hospital app's yesterday-date defect. The same rule holds for date
 * arithmetic: days are added to the day component, not to a timestamp.
 *
 * "Today" is the demo clock (`DEMO_TODAY_ISO`) so the seeded June 2026
 * invoices, due dates and grace windows stay coherent. When the API lands this
 * becomes server time and the constant disappears with the fixtures.
 */
import { DEMO_TODAY_ISO } from '@/core/config/demo';

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

const MS_PER_DAY = 86400000;

/** The ops console's "today" as an ISO `yyyy-mm-dd` date. */
export function opsTodayIso(): string {
  return DEMO_TODAY_ISO;
}

/** ISO `yyyy-mm-dd` from a `Date`, read off its **local** calendar fields. */
export function isoFromDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** "2026-06-13" -> "June 13, 2026". Empty input gives an em dash. */
export function longDateFromIso(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  const month = MONTHS_LONG[Number(m) - 1];
  if (!month) return iso;
  return `${month} ${d}, ${y}`;
}

/** "June 13, 2026" -> "2026-06-13". Returns `null` when it cannot be parsed. */
export function isoFromLongDate(text: string | null | undefined): string | null {
  const ts = Date.parse(String(text ?? ''));
  if (Number.isNaN(ts)) return null;
  return isoFromDate(new Date(ts));
}

/** `days` added to an ISO date on the local calendar (DST- and month-safe). */
export function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return isoFromDate(new Date(y, m - 1, d + days));
}

/** Whole days from `fromIso` to `toIso` — negative when `toIso` is earlier. */
export function daysBetweenIso(fromIso: string, toIso: string): number {
  const [fy, fm, fd] = fromIso.split('-').map(Number);
  const [ty, tm, td] = toIso.split('-').map(Number);
  const from = new Date(fy, fm - 1, fd).getTime();
  const to = new Date(ty, tm - 1, td).getTime();
  return Math.round((to - from) / MS_PER_DAY);
}

/**
 * Audit-line stamp in the console's format: the demo date plus the real
 * wall-clock time, e.g. "June 13, 2026 · 14:32".
 */
export function opsStampNow(): string {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  return `${longDateFromIso(opsTodayIso())} · ${hh}:${mm}`;
}
