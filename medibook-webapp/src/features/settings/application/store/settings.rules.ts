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

/** Consultation slot length options, in the order the select offers them. */
export const SLOT_LENGTH_OPTIONS = ['10 mins', '15 mins', '20 mins', '30 mins'] as const;

/** Gap between consecutive appointments. `0 mins` means back-to-back. */
export const SLOT_BUFFER_OPTIONS = ['0 mins', '5 mins', '10 mins', '15 mins'] as const;

/** How many patients may be booked into one slot. */
export const MAX_PER_SLOT_OPTIONS = ['5 slots', '10 slots', '15 slots', '20 slots'] as const;

/** How long before the appointment a patient may still cancel. */
export const CANCEL_BEFORE_OPTIONS = ['1 hour', '2 hours', '4 hours', '24 hours'] as const;

/** How long after the slot an uncalled patient is auto-marked No-show. */
export const AUTO_NO_SHOW_OPTIONS = ['30 mins', '1 hour', '2 hours'] as const;

/** How long an unpaid online booking holds its slot. */
export const HOLD_TIMEOUT_OPTIONS = ['15 mins', '30 mins', '45 mins'] as const;

/** How long a late patient keeps their place in the queue. */
export const GRACE_OPTIONS = ['15 mins', '30 mins', '45 mins'] as const;

/** What happens when the grace period runs out. */
export const AFTER_GRACE_OPTIONS = ['Auto Mark No-show', 'Keep waiting'] as const;

/** Who issues the token number. */
export const TOKEN_GEN_OPTIONS = ['Auto', 'Manual'] as const;

/**
 * Token numbering scheme. `T-001` is the canonical cross-app format
 * (CANONICAL_MASTER_DATA §5) and the default; the per-department variant
 * exists because the design shipped department prefixes and some hospitals
 * still ask for them.
 */
export const TOKEN_SCHEME_OPTIONS = [
  'Hospital-wide running (T-001)',
  'Per-department prefix (C-001)',
] as const;

export type TokenScheme = (typeof TOKEN_SCHEME_OPTIONS)[number];

/** The canonical scheme — `formatToken()` in `shared/lib/format` implements it. */
export const CANONICAL_TOKEN_SCHEME: TokenScheme = 'Hospital-wide running (T-001)';

/** Hospital opening-time options. */
export const OPEN_TIME_OPTIONS = ['7:00 am', '8:00 am', '9:00 am'] as const;

/** Hospital closing-time options. */
export const CLOSE_TIME_OPTIONS = ['6:00 pm', '8:00 pm', '10:00 pm'] as const;

/* ------------------------------------------------------------------ parsing */

const MINUTES_PER_HOUR = 60;
const HOURS_PER_HALF_DAY = 12;
/** Tokens are zero-padded to three digits in every scheme. */
const TOKEN_DIGITS = 3;

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

/* --------------------------------------------------------------- derivation */

/** Everything `slotsPerDay` needs, so the call site reads like the rule. */
export interface SlotCapacityInput {
  readonly openLabel: string;
  readonly closeLabel: string;
  readonly slotMinutes: number;
  readonly bufferMinutes: number;
}

/**
 * How many consultation slots one doctor's day holds, which is the whole
 * point of the slot-length and buffer rules: each appointment consumes
 * `slotMinutes + bufferMinutes`, and the last slot must still finish before
 * closing time.
 */
export function slotsPerDay({
  openLabel,
  closeLabel,
  slotMinutes,
  bufferMinutes,
}: SlotCapacityInput): number {
  const open = parseTimeLabelMinutes(openLabel);
  const close = parseTimeLabelMinutes(closeLabel);
  const span = close - open;
  const step = slotMinutes + bufferMinutes;
  if (span <= 0 || slotMinutes <= 0 || step <= 0) return 0;
  // The final slot needs `slotMinutes` of room; the buffer after it is free.
  return Math.max(0, Math.floor((span + bufferMinutes) / step));
}

/** The clock time after which a cancellation forfeits the fee. */
export function cancellationDeadline(appointmentTimeLabel: string, cutoffHours: number): string {
  return shiftTimeLabel(appointmentTimeLabel, -cutoffHours * MINUTES_PER_HOUR);
}

/**
 * A token as the chosen scheme renders it. The hospital-wide scheme is the
 * canonical `T-001`; the per-department scheme prefixes the department's
 * initial instead, which is exactly why it is not the default.
 */
export function tokenSample(scheme: string, seq: number, department?: string): string {
  const padded = String(seq).padStart(TOKEN_DIGITS, '0');
  if (scheme === CANONICAL_TOKEN_SCHEME) return `T-${padded}`;
  const initial = (department ?? 'Cardiology').trim().charAt(0).toUpperCase() || 'T';
  return `${initial}-${padded}`;
}

/** The first three tokens of a day under `scheme`, e.g. "T-001, T-002, T-003". */
export function tokenSeriesCopy(scheme: string, department?: string): string {
  return [1, 2, 3].map((n) => tokenSample(scheme, n, department)).join(', ');
}
