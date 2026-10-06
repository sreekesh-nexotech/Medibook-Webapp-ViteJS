import { calendarDate, calendarTimeHm, todayISO } from '@/shared/lib/format';

/**
 * The one clock every trail-stamped action reads: the hospital's, whatever the
 * device is set to (DATA-02). `toISOString()` is never used, because it gives
 * the UTC day, which is the previous day for the first hours of an IST day.
 *
 * Pure functions, no React and no store: safe to call from any layer.
 */

/** A moment's date as `yyyy-mm-dd` on the hospital's calendar. */
export function localDateIso(d: Date = new Date()): string {
  return calendarDate(d);
}

/** A moment's wall-clock time as 24h `HH:MM` on the hospital's clock. */
export function localTimeHm(d: Date = new Date()): string {
  return calendarTimeHm(d);
}

/** Today as `yyyy-mm-dd` on the hospital's calendar. */
export function todayIso(): string {
  return todayISO();
}

/** Weekday index of an ISO date, 0 = Monday … 6 = Sunday. */
export function isoWeekdayIndex(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  const at = new Date(y, (m ?? 1) - 1, d ?? 1, 12, 0, 0, 0);
  return (at.getDay() + 6) % 7;
}
