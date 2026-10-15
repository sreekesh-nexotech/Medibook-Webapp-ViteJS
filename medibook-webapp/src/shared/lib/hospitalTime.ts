/**
 * Hospital-local dates and times (D-09, UAT-47). Every hospital works on its
 * own calendar day in its own zone (`hospitals.timezone`, read from
 * `GET /hospital/me`), so "today" and every displayed clock time are worked
 * out in that zone, never in the zone or clock setting of the PC the desk
 * happens to use. Pure functions, no React.
 */

/** The zone the backend falls back to when a hospital has none (`core/timeutil.tz`). */
export const DEFAULT_HOSPITAL_TIME_ZONE = 'Asia/Kolkata';

/** Length of a calendar day `yyyy-mm-dd`. */
const ISO_DAY_LENGTH = 10;

const ISO_DAY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const MS_PER_DAY = 86_400_000;
const MINUTES_PER_HOUR = 60;
/** Guards engines that still report midnight as hour 24. */
const HOURS_PER_DAY = 24;

const LOCALE = 'en-IN';

/** Formatters are costly to build; keep one per zone and pattern. */
const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${timeZone}|${JSON.stringify(options)}`;
  let fmt = formatters.get(key);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat(LOCALE, { ...options, timeZone });
    formatters.set(key, fmt);
  }
  return fmt;
}

/** A zone the runtime knows, else the backend's default (an unknown zone would throw). */
export function safeTimeZone(timeZone: string | null | undefined): string {
  if (!timeZone) return DEFAULT_HOSPITAL_TIME_ZONE;
  try {
    new Intl.DateTimeFormat(LOCALE, { timeZone });
    return timeZone;
  } catch {
    // An unknown IANA name from the server: fall back the way the backend does.
    return DEFAULT_HOSPITAL_TIME_ZONE;
  }
}

function toDate(instant: Date | number | string): Date | null {
  const date = instant instanceof Date ? instant : new Date(instant);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** The calendar day `yyyy-mm-dd` that `instant` falls on in `timeZone`. */
export function isoDayIn(instant: Date | number | string, timeZone: string): string {
  const date = toDate(instant);
  if (!date) return '';
  const parts = formatter(safeTimeZone(timeZone), {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((p) => p.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

/** The hospital's "today" as `yyyy-mm-dd`. */
export function todayIn(timeZone: string, now: number = Date.now()): string {
  return isoDayIn(now, timeZone);
}

/** `yyyy-mm-dd` shifted by whole calendar days (zone-free arithmetic). */
export function addIsoDays(iso: string, days: number): string {
  const match = ISO_DAY_PATTERN.exec(iso);
  if (!match) return iso;
  const [, y, m, d] = match;
  const shifted = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)) + days * MS_PER_DAY);
  return shifted.toISOString().slice(0, ISO_DAY_LENGTH);
}

/** Whole days from `from` to `to` (both `yyyy-mm-dd`); negative when `to` is earlier. */
export function isoDaysBetween(from: string, to: string): number {
  const a = ISO_DAY_PATTERN.exec(from);
  const b = ISO_DAY_PATTERN.exec(to);
  if (!a || !b) return 0;
  const utc = (m: RegExpExecArray) => Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Math.round((utc(b) - utc(a)) / MS_PER_DAY);
}

/** "9:30 am" — the clock time of `iso` in the hospital's zone; em dash when unreadable. */
export function formatTimeIn(iso: string | null | undefined, timeZone: string): string {
  const date = iso ? toDate(iso) : null;
  if (!date) return '—';
  return formatter(safeTimeZone(timeZone), { hour: 'numeric', minute: '2-digit' }).format(date);
}

/**
 * "13 Jun" — the day of an instant in the hospital's zone, or of a plain
 * `yyyy-mm-dd`, which is already a hospital-local day and is never shifted.
 */
export function formatDayIn(isoOrDay: string | null | undefined, timeZone: string): string {
  if (!isoOrDay) return '—';
  const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  if (isoOrDay.length === ISO_DAY_LENGTH && ISO_DAY_PATTERN.test(isoOrDay)) {
    return formatter('UTC', options).format(new Date(`${isoOrDay}T00:00:00Z`));
  }
  const date = toDate(isoOrDay);
  return date ? formatter(safeTimeZone(timeZone), options).format(date) : '—';
}

/** "Tue, 13 Jun" — like `formatDayIn`, with the weekday. */
export function formatWeekdayDayIn(isoOrDay: string | null | undefined, timeZone: string): string {
  if (!isoOrDay) return '—';
  const options: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' };
  if (isoOrDay.length === ISO_DAY_LENGTH && ISO_DAY_PATTERN.test(isoOrDay)) {
    return formatter('UTC', options).format(new Date(`${isoOrDay}T00:00:00Z`));
  }
  const date = toDate(isoOrDay);
  return date ? formatter(safeTimeZone(timeZone), options).format(date) : '—';
}

/** "13 Jun 2026, 9:30 am" in the hospital's zone; em dash when unreadable. */
export function formatDateTimeIn(iso: string | null | undefined, timeZone: string): string {
  const date = iso ? toDate(iso) : null;
  if (!date) return '—';
  return formatter(safeTimeZone(timeZone), { dateStyle: 'medium', timeStyle: 'short' }).format(
    date,
  );
}

/** Minutes past midnight of `iso` on the hospital's wall clock (0–1439); `null` when unreadable. */
export function minutesOfDayIn(iso: string | null | undefined, timeZone: string): number | null {
  const date = iso ? toDate(iso) : null;
  if (!date) return null;
  const parts = formatter(safeTimeZone(timeZone), {
    hour: 'numeric',
    minute: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(date);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0) % HOURS_PER_DAY;
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return hour * MINUTES_PER_HOUR + minute;
}

/** True when the instant `iso` has been reached: at or before `now`. */
export function isInstantOver(iso: string | null | undefined, now: number = Date.now()): boolean {
  const date = iso ? toDate(iso) : null;
  return date !== null && date.getTime() <= now;
}
