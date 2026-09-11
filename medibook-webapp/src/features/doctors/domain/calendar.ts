/**
 * Pure local-calendar + clock-time helpers for the catalog and the slot grid.
 *
 * Every date here is a **local** calendar date rendered as ISO `yyyy-mm-dd`,
 * assembled from `getFullYear()/getMonth()/getDate()`. `Date.toISOString()` is
 * deliberately absent: on a local-midnight `Date` east of UTC it reports the
 * previous day, which is the root cause of the hospital app's yesterday-date
 * defect (CANONICAL_MASTER_DATA §8).
 *
 * No React, no stores, no other layers — safe to call from anywhere.
 * (These belong in `shared/lib` long-term; `shared/**` is frozen this round,
 * so they live in the owning feature's domain layer for now. The clock-time
 * label helpers deliberately overlap `settings/…/settings.rules.ts`, which
 * reads the *settings* labels: this pair reads the *catalogue's* own labels
 * and the domain layer may not import another feature's application layer.)
 */

/** Monday-first weekday labels, matching the catalog's weekly-hours grid. */
export const WEEK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

export type WeekDayLabel = (typeof WEEK_DAYS)[number];

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_HALF_DAY = 12;
/** `Date.getDay()` is Sunday-first; the grid is Monday-first. */
const SUNDAY_INDEX = 0;
const LAST_WEEKDAY_INDEX = 6;

/** Local calendar date as ISO `yyyy-mm-dd` — never via `toISOString()`. */
export function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Today as a local ISO date. */
export function todayIso(): string {
  return toIsoDate(new Date());
}

/** Parse ISO `yyyy-mm-dd` into a local-midnight `Date` (invalid input → null). */
export function parseIsoDate(iso: string): Date | null {
  if (!ISO_DATE_PATTERN.test(iso)) return null;
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** `iso` shifted by `days` calendar days, still local (DST-safe). */
export function addIsoDays(iso: string, days: number): string {
  const base = parseIsoDate(iso) ?? new Date();
  base.setDate(base.getDate() + days);
  return toIsoDate(base);
}

/** Today shifted by `days` calendar days — used by the demo fixtures. */
export function isoFromToday(days: number): string {
  return addIsoDays(todayIso(), days);
}

/** Monday-first weekday index (0 = Mon … 6 = Sun) of an ISO date. */
export function isoWeekdayIndex(iso: string): number {
  const date = parseIsoDate(iso);
  if (!date) return 0;
  const day = date.getDay();
  return day === SUNDAY_INDEX ? LAST_WEEKDAY_INDEX : day - 1;
}

/** Monday-first weekday label ("Mon".."Sun") of an ISO date. */
export function isoWeekdayLabel(iso: string): WeekDayLabel {
  return WEEK_DAYS[isoWeekdayIndex(iso)];
}

/** True when `iso` falls inside the inclusive `from`–`to` range (ISO compares lexically). */
export function isIsoWithin(iso: string, from: string, to: string): boolean {
  const lo = from <= to ? from : to;
  const hi = from <= to ? to : from;
  return iso >= lo && iso <= hi;
}

/** "Mon 15 Sep" — the slot grid's date-navigator caption. */
export function formatIsoDayLabel(iso: string): string {
  const date = parseIsoDate(iso);
  if (!date) return iso;
  return date.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' });
}

/**
 * "9:00 am" / "9:00 AM" / "14:30" → minutes since midnight; `null` when the
 * label cannot be read (so callers can report a rule problem instead of
 * silently generating a grid from 00:00).
 */
export function timeLabelToMinutes(label: string | null | undefined): number | null {
  const raw = (label ?? '').trim();
  const ampm = /^(\d{1,2}):(\d{2})\s*(am|pm)$/i.exec(raw);
  if (ampm) {
    const hours = Number(ampm[1]) % HOURS_PER_HALF_DAY;
    const offset = /pm/i.test(ampm[3]) ? HOURS_PER_HALF_DAY : 0;
    return (hours + offset) * MINUTES_PER_HOUR + Number(ampm[2]);
  }
  const iso = /^(\d{1,2}):(\d{2})$/.exec(raw);
  if (iso) return Number(iso[1]) * MINUTES_PER_HOUR + Number(iso[2]);
  return null;
}

/** Minutes since midnight → "9:00 am", the label vocabulary the catalog stores. */
export function minutesToTimeLabel(minutes: number): string {
  const dayMinutes = MINUTES_PER_HOUR * 24;
  const total = ((minutes % dayMinutes) + dayMinutes) % dayMinutes;
  const hour24 = Math.floor(total / MINUTES_PER_HOUR);
  const mins = total % MINUTES_PER_HOUR;
  const suffix = hour24 >= HOURS_PER_HALF_DAY ? 'pm' : 'am';
  const hour12 =
    hour24 % HOURS_PER_HALF_DAY === 0 ? HOURS_PER_HALF_DAY : hour24 % HOURS_PER_HALF_DAY;
  return `${hour12}:${String(mins).padStart(2, '0')} ${suffix}`;
}

/** Minutes since local midnight, right now — the "past slot" cutoff. */
export function minutesNow(): number {
  const now = new Date();
  return now.getHours() * MINUTES_PER_HOUR + now.getMinutes();
}
