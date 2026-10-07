import { calendarDate, calendarTimeHm } from '@/shared/lib/format';

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
