import type { IconName } from '@/shared/ui/icon-registry';

import type { Appointment, DoctorStatus } from './appointments.types';

/** Button variant the primary action renders with (subset of shared Button). */
export type PrimaryActionVariant = 'primary' | 'secondary' | 'ghost';

/** The one action an appointment row/card offers in its current state. */
export interface PrimaryAction {
  readonly key: 'approve' | 'receipt' | 'queue' | 'pay' | 'checkin';
  readonly label: string;
  readonly icon: IconName;
  readonly variant: PrimaryActionVariant;
}

/**
 * The primary action available for an appointment given its state — pure
 * helper ported 1:1 from the design prototype (`data.jsx` `primaryAction`),
 * with the desk-confirmation step (HA-05) taking precedence: an appointment
 * waiting on the desk cannot be checked in or paid for until it is approved.
 */
export function primaryAction(a: Appointment): PrimaryAction | null {
  if (a.status === 'Cancelled' || a.status === 'No-show') return null;
  if (a.status === 'Completed')
    return { key: 'receipt', label: 'Receipt', icon: 'receipt', variant: 'secondary' };
  if (a.needsApproval)
    return { key: 'approve', label: 'Approve', icon: 'check-check', variant: 'primary' };
  if (a.status === 'In Queue')
    return { key: 'queue', label: 'In Queue', icon: 'ticket', variant: 'ghost' };
  if (a.source === 'Walk-in' && a.payment === 'Pending')
    return { key: 'pay', label: 'Mark Payment', icon: 'indian-rupee', variant: 'primary' };
  if (a.payment === 'Waived' || a.payment === 'Refunded')
    return { key: 'checkin', label: 'Issue Token', icon: 'log-in', variant: 'primary' };
  // paid (online) or walk-in already paid, not yet in queue
  return {
    key: 'checkin',
    label: a.source === 'Online' ? 'Check In' : 'Issue Token',
    icon: 'log-in',
    variant: 'primary',
  };
}

/* ------------------------------------------------------------------------- *
 * Local calendar dates (audit 4.5 — "appointments land on yesterday")
 * ------------------------------------------------------------------------- *
 *
 * `relToISO()` in `@/shared/lib/format` builds LOCAL midnight and then calls
 * `toISOString()`, which converts to UTC. In IST (UTC+5:30 — this product's
 * market) local midnight is 18:30 UTC on the PREVIOUS day, so the helper
 * returns yesterday: a Create Appointment form opened and submitted without
 * touching the date field saved `"10 Sep"` instead of `"Today"`, dropping the
 * appointment out of the default Today view and orphaning the walk-in's token
 * (`queueForDoctor` only queues `date === 'Today'`).
 *
 * The helpers below assemble the ISO string by hand from `getFullYear()` /
 * `getMonth()` / `getDate()` and never touch `toISOString()`, so they are
 * correct in every timezone. Use these, not `relToISO`, anywhere in this
 * feature. `isoToRelLocal` also pins the month names instead of relying on
 * `toLocaleDateString`, whose `en-IN` short month is "Sept" on some runtimes
 * and "Sep" on others — the seed labels are "14 Jun".
 */

/** Month labels the hospital seed uses ("14 Jun"), independent of the runtime locale. */
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

const MS_PER_DAY = 86_400_000;

/** `yyyy-mm-dd` for a `Date`, read in the browser's own timezone. */
function toLocalISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Local midnight for an ISO date — parsing without a `Z`, so no UTC shift. */
function fromISO(iso: string): Date {
  return new Date(`${iso}T00:00:00`);
}

/** Today's date in the user's own timezone, as `yyyy-mm-dd`. */
export function todayISO(): string {
  return toLocalISO(new Date());
}

/** `iso` shifted by `days`, staying on local calendar days. */
export function addDaysISO(iso: string, days: number): string {
  const d = fromISO(iso);
  d.setDate(d.getDate() + days);
  return toLocalISO(d);
}

/** Whole local days from today to `iso` (negative = in the past). */
export function daysFromTodayISO(iso: string): number {
  const from = fromISO(todayISO()).getTime();
  const to = fromISO(iso).getTime();
  return Math.round((to - from) / MS_PER_DAY);
}

/** True when `iso` is a valid date before today, in local time. */
export function isPastISO(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const d = fromISO(iso);
  if (Number.isNaN(d.getTime())) return false;
  return daysFromTodayISO(iso) < 0;
}

/**
 * ISO date -> the relative labels the hospital store keys off ("Today",
 * "Tomorrow", "14 Jun"). The timezone-safe replacement for `isoToRel`.
 */
export function isoToRelLocal(iso: string): string {
  const d = fromISO(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const diff = daysFromTodayISO(iso);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  return `${String(d.getDate()).padStart(2, '0')} ${MONTHS_SHORT[d.getMonth()]}`;
}

/**
 * Relative label -> ISO date. The timezone-safe replacement for `relToISO`,
 * and unlike it this one also understands the seed's `"14 Jun"` labels
 * (`relToISO` silently returned today for those, so opening Edit or
 * Reschedule on a future-dated appointment reset its date).
 */
export function relToISOLocal(rel: string): string {
  const label = rel.trim();
  if (label === '' || label === 'Today') return todayISO();
  if (label === 'Tomorrow') return addDaysISO(todayISO(), 1);
  if (/^\d{4}-\d{2}-\d{2}$/.test(label)) return label;
  const parts = /^(\d{1,2})\s+([A-Za-z]{3,})$/.exec(label);
  if (parts) {
    const day = Number(parts[1]);
    const month = MONTHS_SHORT.findIndex(
      (m) => m.toLowerCase() === parts[2].slice(0, 3).toLowerCase(),
    );
    if (month >= 0) {
      const now = new Date();
      return toLocalISO(new Date(now.getFullYear(), month, day));
    }
  }
  return todayISO();
}

/* ------------------------------------------------------------------------- *
 * Money: GST + receipt series (audit HA-10)
 * ------------------------------------------------------------------------- */

/** GST charged on a consultation. Shown as its own line — never baked into the fee. */
export const GST_RATE = 0.18;

/** Label the receipt prints for the tax line. */
export const GST_LABEL = 'GST @ 18%';

/** The hospital's registration, as it must appear on a tax receipt. */
export const HOSPITAL_GSTIN = '27AABCM9407L1ZK';

/** Demo hospital identity — the design read these from `window.__*`. */
export const HOSPITAL_NAME = 'Apollo Hospital';
export const HOSPITAL_LOGO_SRC = '/assets/apollo-logo.png';

/** A consultation total split into its taxable value, the tax and the gross. */
export interface TaxBreakdown {
  /** The consultation fee(s) — the pre-tax, quoted amount. */
  readonly subtotal: number;
  /** 18% of `subtotal`, rounded to the rupee. */
  readonly gst: number;
  /** What the patient actually pays: `subtotal + gst`. */
  readonly total: number;
}

/**
 * Split a consultation fee (or the sum of several) into subtotal + GST + total.
 * The fee stored on an appointment is always the pre-tax figure the desk quotes,
 * so the tax is added here and displayed on its own line.
 */
export function taxBreakdown(subtotal: number): TaxBreakdown {
  const base = Number.isFinite(subtotal) ? Math.max(0, subtotal) : 0;
  const gst = Math.round(base * GST_RATE);
  return { subtotal: base, gst, total: base + gst };
}

/** Gross payable for one appointment — the figure a refund is capped at. */
export function grossAmount(a: Pick<Appointment, 'amount'>): number {
  return taxBreakdown(a.amount).total;
}

/** Receipt-series prefix: `MB/R/<financial year>/<6-digit sequence>`. */
const RECEIPT_PREFIX = 'MB/R';
const RECEIPT_SEQ_DIGITS = 6;
/** The Indian financial year starts in April (month index 3). */
const FY_START_MONTH_INDEX = 3;

/** The Indian financial year a local date falls in, e.g. `"2026-27"`. */
export function financialYear(d: Date = new Date()): string {
  const year = d.getFullYear();
  const startYear = d.getMonth() >= FY_START_MONTH_INDEX ? year : year - 1;
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`;
}

/**
 * Format a receipt number from the store's running sequence:
 * `formatReceiptNo(123)` -> `"MB/R/2026-27/000123"`.
 */
export function formatReceiptNo(seq: number, d: Date = new Date()): string {
  return `${RECEIPT_PREFIX}/${financialYear(d)}/${String(seq).padStart(RECEIPT_SEQ_DIGITS, '0')}`;
}

/* ------------------------------------------------------------------------- *
 * Front-desk capacity
 * ------------------------------------------------------------------------- */

/** Soft daily cap per doctor (illustrative; backend-driven later). */
export const DOCTOR_DAILY_CAP = 16;

/** Doctor statuses that make the doctor unavailable for new walk-ins. */
export const DOCTOR_OFF_STATUSES: readonly string[] = ['On Break', 'On Leave', 'Inactive'];

/** Statuses that no longer occupy a slot. */
const RELEASED_STATUSES: readonly Appointment['status'][] = ['Cancelled', 'No-show'];

/** Front-desk capacity signal for one doctor (design `doctorLoadToday`). */
export interface DoctorLoad {
  readonly booked: number;
  readonly status: DoctorStatus;
  readonly cap: number;
  readonly full: boolean;
  readonly off: boolean;
}

/**
 * Today's load for one doctor. Pure, so a component can derive it from the
 * slices it already subscribes to instead of memoising a store call — which is
 * what the `useMemo` in `DoctorCapacityHint` was working around.
 */
export function doctorLoad(
  appts: readonly Appointment[],
  docStatus: Readonly<Record<string, DoctorStatus>>,
  doctor: string,
): DoctorLoad {
  const booked = appts.filter(
    (a) => a.doctor === doctor && a.date === 'Today' && !RELEASED_STATUSES.includes(a.status),
  ).length;
  const status = docStatus[doctor] ?? 'Available';
  return {
    booked,
    status,
    cap: DOCTOR_DAILY_CAP,
    full: booked >= DOCTOR_DAILY_CAP,
    off: DOCTOR_OFF_STATUSES.includes(status),
  };
}
