import { HOSPITAL_TIME_ZONE } from './env.ts';

/**
 * Hospital-local calendar helpers. The stack runs on the real clock, so every
 * date a step uses is derived from "now" in the hospital's time zone (UAT-47),
 * never hard-coded.
 */

const MS_PER_MINUTE = 60_000;
const MS_PER_DAY = 86_400_000;
const SUNDAY = 6;
/** JS `getUTCDay()` counts from Sunday; the backend from Monday. */
const JS_DAY_OFFSET = 6;
const MONTHS_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

const isoFormat = (timeZone: string) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

const clockFormat = (timeZone: string) =>
  new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });

/** `yyyy-mm-dd` of `at` in `timeZone`. */
export function isoDateIn(at: Date, timeZone: string = HOSPITAL_TIME_ZONE): string {
  return isoFormat(timeZone).format(at);
}

/** Hospital-local today. */
export function todayIso(timeZone: string = HOSPITAL_TIME_ZONE): string {
  return isoDateIn(new Date(), timeZone);
}

/** `iso` moved by `days` calendar days. */
export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const utc = Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1) + days * MS_PER_DAY;
  return new Date(utc).toISOString().slice(0, 10);
}

/** Monday = 0 … Sunday = 6 (the backend's weekday numbering). */
export function weekdayOf(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  const js = new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1)).getUTCDay();
  return (js + JS_DAY_OFFSET) % 7;
}

export function isSunday(iso: string): boolean {
  return weekdayOf(iso) === SUNDAY;
}

/** `HH:MM` (24 h) of `at` in `timeZone`. */
export function clockIn(at: Date, timeZone: string = HOSPITAL_TIME_ZONE): string {
  return clockFormat(timeZone).format(at);
}

/** Minutes since local midnight of an `HH:MM` value. */
export function minutesOf(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** `HH:MM` for minutes since midnight. */
export function hhmm(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Minutes from now until an ISO instant (negative when it is past). */
export function minutesUntil(isoInstant: string): number {
  return (Date.parse(isoInstant) - Date.now()) / MS_PER_MINUTE;
}

/** First and last day of the calendar month before `iso`'s month. */
export function previousMonth(iso: string): { readonly from: string; readonly to: string } {
  const firstOfThis = `${iso.slice(0, 8)}01`;
  const to = addDays(firstOfThis, -1);
  return { from: `${to.slice(0, 8)}01`, to };
}

/** Monday of the week containing `iso`. */
export function mondayOf(iso: string): string {
  return addDays(iso, -weekdayOf(iso));
}

/** The app's date format (`shared/lib/format.ts` `fmtDate`): "08 Oct 2026". */
export function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d} ${MONTHS_SHORT[Number(m) - 1] ?? ''} ${y}`;
}

/** The app's rupee format (`shared/lib/format.ts` `money`): "₹ 1,500". */
export function rupees(amount: number): string {
  return `₹ ${amount.toLocaleString('en-IN')}`;
}
