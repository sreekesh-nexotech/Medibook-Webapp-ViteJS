/**
 * Pure formatting + date helpers ported 1:1 from the design file
 * (`data.jsx` / `Ops.jsx`). No React, no stores — safe everywhere.
 */

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

const PAISE_PER_RUPEE = 100;

/** Integer paise as a plain two-decimal rupee figure, for exports: 9050 → "90.50". */
export function rupeesFromPaise(paise: number): string {
  const whole = Math.round(paise);
  const sign = whole < 0 ? '-' : '';
  const abs = Math.abs(whole);
  const fraction = String(abs % PAISE_PER_RUPEE).padStart(2, '0');
  return `${sign}${Math.trunc(abs / PAISE_PER_RUPEE)}.${fraction}`;
}

/** Rupees, as the entities carry them, as the same export figure: 90.5 → "90.50". */
export function rupeesFixed(rupees: number): string {
  return rupeesFromPaise(Math.round(rupees * PAISE_PER_RUPEE));
}

/** Integer paise as "₹ 1,02,400.50": always two decimals, digits from the integer (DATA-06). */
export function moneyFromPaise(paise: number): string {
  const [whole, fraction] = rupeesFromPaise(paise).split('.');
  const sign = whole.startsWith('-') ? '-' : '';
  return `₹ ${sign}${Number(whole.replace('-', '')).toLocaleString('en-IN')}.${fraction}`;
}

/** "₹ 1,02,400.00" (en-IN grouping, exactly two decimals); em dash for missing values. */
export function money(n: number | null | undefined): string {
  if (n == null) return '—';
  return moneyFromPaise(Math.round(Number(n) * PAISE_PER_RUPEE));
}

/** Compact rupee figures for KPI tiles: "₹ 2.6L", "₹ 9.8K". */
export function moneyShort(n: number): string {
  if (n >= 100000) return '₹ ' + (n / 100000).toFixed(n % 100000 === 0 ? 0 : 1) + 'L';
  if (n >= 1000) return '₹ ' + (n / 1000).toFixed(n % 1000 === 0 ? 0 : 1) + 'K';
  return '₹ ' + n;
}

/** "2026-06-20" -> "20 Jun 2026"; em dash for missing values. */
export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d} ${MONTHS_SHORT[Number(m) - 1]} ${y}`;
}

/* ---------------------------------------------------- the hospital's calendar */

/** India Standard Time: the product's market, and the calendar until a hospital says otherwise. */
export const DEFAULT_CALENDAR_ZONE = 'Asia/Kolkata';

const MS_PER_DAY = 86_400_000;

let calendarZone: string = DEFAULT_CALENDAR_ZONE;
const zonedFormats = new Map<string, Intl.DateTimeFormat>();

function zonedFormat(locale: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${calendarZone}|${locale}|${JSON.stringify(options)}`;
  let format = zonedFormats.get(key);
  if (!format) {
    format = new Intl.DateTimeFormat(locale, { ...options, timeZone: calendarZone });
    zonedFormats.set(key, format);
  }
  return format;
}

/**
 * Follow the signed-in hospital's time zone (`timezone` on `/hospital/me`) for
 * "today" and for every timestamp shown as a date or a time, whatever the
 * device's own clock is set to (DATA-01, DATA-02). A missing or unknown zone
 * keeps India Standard Time.
 */
export function setCalendarZone(zone: string | null | undefined): void {
  if (!zone) {
    calendarZone = DEFAULT_CALENDAR_ZONE;
    return;
  }
  try {
    calendarZone = new Intl.DateTimeFormat('en-CA', { timeZone: zone }).resolvedOptions().timeZone;
  } catch {
    calendarZone = DEFAULT_CALENDAR_ZONE;
  }
}

/** The zone every date and time in the app follows. */
export function calendarTimeZone(): string {
  return calendarZone;
}

/** A moment (server timestamp, `Date` or epoch ms) formatted on the hospital's clock. */
export function formatInstant(
  instant: Date | string | number,
  options: Intl.DateTimeFormatOptions,
  locale = 'en-IN',
): string {
  return zonedFormat(locale, options).format(new Date(instant));
}

/** "10:42" — the "Updated …" caption beside a list's Refresh button. */
export function formatUpdatedAt(updatedAt: number): string {
  return formatInstant(updatedAt, { hour: '2-digit', minute: '2-digit' });
}

function zonedPart(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
  return parts.find((p) => p.type === type)?.value ?? '';
}

/** The calendar date (`yyyy-mm-dd`) of a moment on the hospital's calendar. */
export function calendarDate(instant: Date | string | number = Date.now()): string {
  const parts = zonedFormat('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(instant));
  return `${zonedPart(parts, 'year')}-${zonedPart(parts, 'month')}-${zonedPart(parts, 'day')}`;
}

/** The wall-clock time (`HH:MM`, 24h) of a moment on the hospital's clock. */
export function calendarTimeHm(instant: Date | string | number = Date.now()): string {
  const parts = zonedFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(instant));
  return `${zonedPart(parts, 'hour')}:${zonedPart(parts, 'minute')}`;
}

/** The zone's UTC offset on `day`, as `+05:30` (`+00:00` for UTC). */
function zoneOffset(day: string): string {
  const name = zonedFormat('en-US', { timeZoneName: 'longOffset' })
    .formatToParts(new Date(`${day}T12:00:00Z`))
    .find((p) => p.type === 'timeZoneName')?.value;
  return /([+-]\d{2}:\d{2})$/.exec(name ?? '')?.[1] ?? '+00:00';
}

/**
 * A wall-clock time on a calendar day in the hospital's zone, as an ISO
 * date-time with its offset (`2026-10-06T00:00:00+05:30`). Day boundaries and
 * dates built this way mean the same day on every device (DATA-03).
 */
export function calendarInstant(day: string, time = '00:00:00'): string {
  return `${day}T${time}${zoneOffset(day)}`;
}

/** Minutes since midnight on the hospital's clock. */
export function minutesOfDay(instant: Date | string | number = Date.now()): number {
  const [hours, minutes] = calendarTimeHm(instant).split(':').map(Number);
  return hours * 60 + minutes;
}

/** Days since 1970-01-01 for a `yyyy-mm-dd` — calendar arithmetic, no time zone. */
function dayNumber(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / MS_PER_DAY;
}

function isoFromDayNumber(day: number): string {
  const t = new Date(day * MS_PER_DAY);
  const m = String(t.getUTCMonth() + 1).padStart(2, '0');
  const d = String(t.getUTCDate()).padStart(2, '0');
  return `${t.getUTCFullYear()}-${m}-${d}`;
}

/**
 * Local calendar date as `yyyy-mm-dd`, for a `Date` built from calendar parts
 * (`new Date(y, m, d)`). A moment in time goes through `calendarDate` instead.
 *
 * Assembled from the local date parts on purpose. `toISOString()` converts to
 * UTC first, so in any zone ahead of UTC a local-midnight Date serialises to
 * the PREVIOUS day — in IST (this product's market) `relToISO('Today')` used to
 * return yesterday, which is what made new appointments land on yesterday,
 * disappear from the default Today view, and take a walk-in token that never
 * reached a queue. Never reintroduce `toISOString()` here.
 */
export function toLocalISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Today's date (`yyyy-mm-dd`) on the hospital's calendar, not the device's. */
export function todayISO(): string {
  return calendarDate();
}

/** `yyyy-mm-dd` shifted by whole days. */
export function addDaysISO(iso: string, days: number): string {
  return isoFromDayNumber(dayNumber(iso) + days);
}

/** Whole days from today to `iso` (negative = past), on the hospital's calendar. */
export function daysFromTodayISO(iso: string): number {
  return dayNumber(iso) - dayNumber(todayISO());
}

/** True when `iso` is before today (hospital calendar). */
export function isPastISO(iso: string): boolean {
  return daysFromTodayISO(iso) < 0;
}

/**
 * ISO date -> the relative labels the hospital seed uses ("Today", "Tomorrow",
 * "14 Jun").
 *
 * The month abbreviation comes from the pinned `MONTHS_SHORT` array, not from
 * `toLocaleDateString`. ICU's en-IN short month is inconsistent in width — it
 * yields "Sept" for September but "Jun" for June — so a locale-formatted label
 * silently stopped matching `fmtDate`'s output (and the seed's) every
 * September, and exact-date filters comparing the two never matched.
 */
export function isoToRel(iso: string): string {
  const diff = daysFromTodayISO(iso);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  const [, m, d] = iso.split('-');
  return `${d} ${MONTHS_SHORT[Number(m) - 1]}`;
}

/**
 * Relative label -> ISO date. Understands "Today", "Tomorrow" and the seed's
 * "14 Jun" / "14 Jun 2026" day-month labels; anything unrecognised falls back
 * to today.
 *
 * A bare day-month label carries no year, so it resolves against the current
 * year and then rolls forward when that would put it more than six months in
 * the past — which keeps the seed's near-future labels in the future across a
 * year boundary instead of silently collapsing them to today.
 */
export function relToISO(rel: string): string {
  const label = rel.trim();
  if (label === 'Tomorrow') return addDaysISO(todayISO(), 1);
  if (label === 'Today' || label === '') return todayISO();

  const m = /^(\d{1,2})\s+([A-Za-z]{3,})\.?(?:\s+(\d{4}))?$/.exec(label);
  if (m) {
    const day = Number(m[1]);
    const prefix = m[2].slice(0, 3).toLowerCase();
    const month = MONTHS_SHORT.findIndex((x) => x.toLowerCase() === prefix);
    if (month >= 0) {
      const year = m[3] ? Number(m[3]) : Number(todayISO().slice(0, 4));
      const onDay = (y: number) => isoFromDayNumber(Date.UTC(y, month, day) / MS_PER_DAY);
      const iso = onDay(year);
      return !m[3] && daysFromTodayISO(iso) < -183 ? onDay(year + 1) : iso;
    }
  }

  // Already an ISO date.
  if (/^\d{4}-\d{2}-\d{2}$/.test(label)) return label;

  return todayISO();
}

/** "8:30 am" -> minutes since midnight, for time-column sorting. */
export function timeToMinutes(t: string | null | undefined): number {
  const m = /(\d+):(\d+)\s*(am|pm)/i.exec(t ?? '');
  if (!m) return 0;
  let h = Number(m[1]) % 12;
  if (/pm/i.test(m[3])) h += 12;
  return h * 60 + Number(m[2]);
}

/** Up to nine whole digits and at most two decimals, commas allowed ("1,250.75"). */
const HUNDREDTHS_PATTERN = /^(\d{1,9})(?:\.(\d{1,2}))?$/;

/**
 * A decimal a person typed, with at most two places, as an integer count of
 * hundredths — paise for a rupee amount, basis points for a percentage — or
 * `null` when it is not such a number. Parsed from the digits, so there is no
 * floating-point rounding.
 */
export function parseHundredths(text: string): number | null {
  const match = HUNDREDTHS_PATTERN.exec(text.replace(/,/g, '').trim());
  if (!match) return null;
  const [, whole = '0', fraction = ''] = match;
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}

/** India's country code; numbers there are shown in the national grouping. */
const INDIA_PREFIX = '+91';
const INDIAN_NUMBER = /^\d{10}$/;
const INDIAN_MOBILE = /^[6-9]/;

/**
 * An E.164 number as people read it: `+919876543210` → "+91 98765 43210",
 * `+914847100000` → "+91 484 710 0000". Anything else is shown as stored.
 */
export function phoneDisplay(e164: string): string {
  if (!e164.startsWith(INDIA_PREFIX)) return e164;
  const digits = e164.slice(INDIA_PREFIX.length);
  if (!INDIAN_NUMBER.test(digits)) return e164;
  return INDIAN_MOBILE.test(digits)
    ? `${INDIA_PREFIX} ${digits.slice(0, 5)} ${digits.slice(5)}`
    : `${INDIA_PREFIX} ${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
}
