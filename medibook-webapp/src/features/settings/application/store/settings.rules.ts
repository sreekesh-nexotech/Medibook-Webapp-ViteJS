/**
 * The hospital rulebook, as values rather than labels — audit 2.6.4:
 * "Hospital Settings holds the contract's per-hospital rules (slot length,
 * buffer, cancellation cut-off, hold timeout, auto no-show, token scheme,
 * fees). No screen behaves differently after they are changed, so none of
 * them can be validated."
 *
 * The settings record stores the option *labels* the selects offer ("15
 * mins", "4 hours", "Auto Mark No-show") because that is what the design
 * shipped. This module is the single place those labels become numbers, and
 * the single place the consequences are derived from them — so the settings
 * screen can show what a rule actually does, and the slot / cancellation /
 * token features can consume one shared interpretation instead of parsing
 * strings again.
 *
 * Pure functions and constants only: no React, no store, no I/O.
 */

/* ------------------------------------------------------------- option lists */

/**
 * Scheduling horizon: how far ahead the booking calendar is open. The slot
 * generator must not produce a slot beyond it, and the patient app must not
 * offer one.
 */
export const SCHEDULING_HORIZON_OPTIONS = [
  '7 days',
  '14 days',
  '30 days',
  '60 days',
  '90 days',
] as const;

/** How long before the appointment a patient may still cancel. */
export const CANCEL_BEFORE_OPTIONS = ['1 hour', '2 hours', '4 hours', '24 hours'] as const;

/** Hospital opening-time options. */
export const OPEN_TIME_OPTIONS = ['7:00 am', '8:00 am', '9:00 am'] as const;

/** Hospital closing-time options. */
export const CLOSE_TIME_OPTIONS = ['6:00 pm', '8:00 pm', '10:00 pm'] as const;

/* ------------------------------------------------------------------ parsing */

const MINUTES_PER_HOUR = 60;
const HOURS_PER_HALF_DAY = 12;

const DURATION_PATTERN = /^(\d+)\s*(min|hour)/i;
const COUNT_PATTERN = /^(\d+)/;
const TIME_PATTERN = /^(\d{1,2}):(\d{2})\s*(am|pm)$/i;

/**
 * "15 mins" -> 15, "1 hour" -> 60, "24 hours" -> 1440, "0 mins" -> 0.
 * An unrecognised label yields `fallback`, so a stale persisted value can
 * never make a screen render `NaN`.
 */
export function parseDurationMinutes(label: string, fallback = 0): number {
  const m = DURATION_PATTERN.exec(label.trim());
  if (!m) return fallback;
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return fallback;
  return m[2].toLowerCase() === 'hour' ? n * MINUTES_PER_HOUR : n;
}

/** "15 slots" -> 15; "10" -> 10; anything else -> `fallback`. */
export function parseCount(label: string, fallback = 0): number {
  const m = COUNT_PATTERN.exec(label.trim());
  const n = m ? Number(m[1]) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

/** "8:00 am" -> 480 minutes past midnight; "8:00 pm" -> 1200. */
export function parseTimeLabelMinutes(label: string, fallback = 0): number {
  const m = TIME_PATTERN.exec(label.trim());
  if (!m) return fallback;
  const hour12 = Number(m[1]) % HOURS_PER_HALF_DAY;
  const minutes = Number(m[2]);
  const pm = m[3].toLowerCase() === 'pm';
  return (hour12 + (pm ? HOURS_PER_HALF_DAY : 0)) * MINUTES_PER_HOUR + minutes;
}

/** 630 -> "10:30 am"; 1200 -> "8:00 pm". Wraps within one day. */
export function minutesToTimeLabel(total: number): string {
  const wrapped = ((Math.round(total) % 1440) + 1440) % 1440;
  const hour24 = Math.floor(wrapped / MINUTES_PER_HOUR);
  const minutes = wrapped % MINUTES_PER_HOUR;
  const suffix = hour24 >= HOURS_PER_HALF_DAY ? 'pm' : 'am';
  const hour12 = hour24 % HOURS_PER_HALF_DAY === 0 ? 12 : hour24 % HOURS_PER_HALF_DAY;
  return `${hour12}:${String(minutes).padStart(2, '0')} ${suffix}`;
}

/** "9:30 am" shifted by `minutes` (may be negative) as a time label. */
export function shiftTimeLabel(label: string, minutes: number): string {
  return minutesToTimeLabel(parseTimeLabelMinutes(label) + minutes);
}

/** A duration in minutes as readable copy: 90 -> "1 h 30 min", 60 -> "1 h". */
export function durationCopy(minutes: number): string {
  if (minutes < MINUTES_PER_HOUR) return `${minutes} min`;
  const h = Math.floor(minutes / MINUTES_PER_HOUR);
  const m = minutes % MINUTES_PER_HOUR;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** Weekday index of an ISO date on the local calendar, 0 = Monday .. 6 = Sunday. */
export function isoWeekdayIndex(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  // Noon avoids any DST edge; the parts are read back locally, never via UTC.
  return (new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1, 12).getDay() + 6) % 7;
}

/**
 * Open days inside the scheduling horizon: the horizon counts calendar days,
 * but only the days the hospital is open can carry a slot. Day 1 of the
 * horizon is `startIso` itself.
 */
export function openDaysInHorizon(
  startIso: string,
  horizonDays: number,
  openFlags: readonly boolean[],
): number {
  if (horizonDays <= 0 || openFlags.length === 0) return 0;
  const first = isoWeekdayIndex(startIso);
  let open = 0;
  for (let i = 0; i < horizonDays; i += 1) {
    if (openFlags[(first + i) % openFlags.length] === true) open += 1;
  }
  return open;
}

/** The clock time after which a cancellation forfeits the fee. */
export function cancellationDeadline(appointmentTimeLabel: string, cutoffHours: number): string {
  return shiftTimeLabel(appointmentTimeLabel, -cutoffHours * MINUTES_PER_HOUR);
}

/* ------------------------------------------------- token labels and numbers */

/** `{NAME}` or `{NAME:arg}` — the placeholder syntax of both backend renderers. */
const PLACEHOLDER = /\{([A-Z]+)(?::([A-Za-z0-9]+))?\}/g;

const TOKEN_LABEL_NAMES = ['PREFIX', 'SEQ', 'SRC', 'DOC', 'DEPT', 'DATE'] as const;
const SERIES_NAMES = ['PREFIX', 'SEQ', 'FY', 'YY', 'YYYY', 'MM'] as const;
const MAX_SEQ_DIGITS = 12;
const DEFAULT_DATE_PATTERN = 'DDMM';
const TWO_DIGITS = 2;
const CENTURY = 100;

/** A calendar day as plain numbers (month 1–12). */
export interface CalendarDay {
  readonly year: number;
  readonly month: number;
  readonly day: number;
}

/** `2026-10-07` → `{year: 2026, month: 10, day: 7}`. */
export function calendarDay(iso: string): CalendarDay {
  const [year, month, day] = iso.split('-').map(Number);
  return { year: year ?? 1970, month: month ?? 1, day: day ?? 1 };
}

function pad2(n: number): string {
  return String(n).padStart(TWO_DIGITS, '0');
}

/** What a format's placeholders name, in order. */
function placeholders(format: string): { readonly name: string; readonly arg: string }[] {
  return [...format.matchAll(PLACEHOLDER)].map((m) => ({ name: m[1] ?? '', arg: m[2] ?? '' }));
}

function unknownNames(format: string, allowed: readonly string[]): string[] {
  return [...new Set(placeholders(format).map((p) => p.name))].filter((n) => !allowed.includes(n));
}

/** Why the server would refuse a token label format, or `null` (backend `validate_label_format`). */
export function tokenFormatProblem(format: string): string | null {
  const unknown = unknownNames(format, TOKEN_LABEL_NAMES);
  if (unknown.length > 0) return `Unknown placeholder: {${unknown.join('}, {')}}.`;
  if (placeholders(format).filter((p) => p.name === 'SEQ').length !== 1) {
    return 'Use {SEQ} or {SEQ:3} exactly once — it is the token number.';
  }
  return null;
}

/** What a token label shows, as the backend renders it (`render_label`). */
export interface TokenLabelParts {
  readonly prefix: string;
  /** The online or walk-in marker, printed for `{SRC}`. */
  readonly marker: string;
  readonly seq: number;
  readonly doctorCode: string;
  readonly departmentCode: string;
  readonly date: CalendarDay;
}

export function renderTokenLabel(format: string, parts: TokenLabelParts): string {
  return format.replace(PLACEHOLDER, (whole, name: string, arg: string | undefined) => {
    if (name === 'SEQ') {
      return arg && /^\d+$/.test(arg)
        ? String(parts.seq).padStart(Number(arg), '0')
        : String(parts.seq);
    }
    if (name === 'PREFIX') return parts.prefix;
    if (name === 'SRC') return parts.marker;
    if (name === 'DOC') return parts.doctorCode.toUpperCase();
    if (name === 'DEPT') return parts.departmentCode.toUpperCase();
    if (name === 'DATE') {
      const { year, month, day } = parts.date;
      return (arg || DEFAULT_DATE_PATTERN)
        .replace('YYYY', String(year))
        .replace('YY', pad2(year % CENTURY))
        .replace('MM', pad2(month))
        .replace('DD', pad2(day));
    }
    return whole;
  });
}

/** Why the server would refuse a number-series format, or `null` (backend `validate_format`). */
export function seriesFormatProblem(format: string): string | null {
  const unknown = unknownNames(format, SERIES_NAMES);
  if (unknown.length > 0) return `Unknown placeholder: {${unknown.join('}, {')}}.`;
  const seqs = placeholders(format).filter((p) => p.name === 'SEQ');
  if (seqs.length !== 1) return 'Use {SEQ} or {SEQ:4} exactly once — it is the running number.';
  const digits = seqs[0]?.arg ?? '';
  if (
    digits !== '' &&
    !(/^\d+$/.test(digits) && Number(digits) >= 1 && Number(digits) <= MAX_SEQ_DIGITS)
  ) {
    return `{SEQ:n} takes 1 to ${MAX_SEQ_DIGITS} digits.`;
  }
  const rest = format.replace(PLACEHOLDER, '');
  if (rest.includes('{') || rest.includes('}')) return 'A brace is not closed.';
  return null;
}

/** What a series number shows (backend `numbering.render`). */
export interface SeriesNumberParts {
  readonly prefix: string;
  readonly seq: number;
  readonly padWidth: number;
  readonly fyStartMonth: number;
  readonly date: CalendarDay;
}

/** `{FY}` for a date: "26-27" when the financial year starts in April 2026. */
export function financialYearToken(date: CalendarDay, fyStartMonth: number): string {
  const start = date.month >= fyStartMonth ? date.year : date.year - 1;
  return `${pad2(start % CENTURY)}-${pad2((start + 1) % CENTURY)}`;
}

export function renderSeriesNumber(format: string, parts: SeriesNumberParts): string {
  return format.replace(PLACEHOLDER, (whole, name: string, arg: string | undefined) => {
    if (name === 'SEQ') return String(parts.seq).padStart(arg ? Number(arg) : parts.padWidth, '0');
    if (name === 'PREFIX') return parts.prefix;
    if (name === 'FY') return financialYearToken(parts.date, parts.fyStartMonth);
    if (name === 'YY') return pad2(parts.date.year % CENTURY);
    if (name === 'YYYY') return String(parts.date.year);
    if (name === 'MM') return pad2(parts.date.month);
    return whole;
  });
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
}

/**
 * The running number inside a series' next number — `LKSR/26-27/00170` under
 * `{PREFIX}/{FY}/{SEQ:5}` is 170 — or `null` when the format can't be read
 * back unambiguously.
 */
export function seqOfNumber(format: string, prefix: string, number: string): number | null {
  let pattern = '';
  let last = 0;
  for (const m of format.matchAll(PLACEHOLDER)) {
    const index = m.index ?? 0;
    pattern += escapeRegExp(format.slice(last, index));
    const name = m[1];
    pattern +=
      name === 'SEQ'
        ? '(\\d+)'
        : name === 'PREFIX'
          ? escapeRegExp(prefix)
          : name === 'FY'
            ? '\\d{2}-\\d{2}'
            : name === 'YYYY'
              ? '\\d{4}'
              : '\\d{2}';
    last = index + m[0].length;
  }
  pattern += escapeRegExp(format.slice(last));
  const seq = new RegExp(`^${pattern}$`).exec(number)?.[1];
  return seq === undefined ? null : Number(seq);
}
