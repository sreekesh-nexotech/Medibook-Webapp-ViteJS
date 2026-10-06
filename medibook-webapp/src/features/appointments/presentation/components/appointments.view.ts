import type { PermissionKey } from '@/shared/hooks/usePermission';
import type { IconName } from '@/shared/ui/icon-registry';

import type {
  AppointmentRange,
  ApptPaymentStatus,
  ApptSource,
  ApptStatus,
  DeskAppointment,
  PaymentMethod,
} from '@/features/appointments/domain/entities/appointments.entities';

/**
 * View-model helpers for the desk appointment screens: badge labels, local
 * times, the list's date windows and the row's primary action. Pure, no React.
 */

/* ------------------------------------------------------------------ labels */

/** Badge text (keys of the shared status map) for each backend status. */
export const STATUS_LABEL: Readonly<Record<ApptStatus, string>> = {
  pending_payment: 'Awaiting payment',
  pending_approval: 'Scheduled',
  scheduled: 'Scheduled',
  checked_in: 'In Queue',
  in_consultation: 'In Queue',
  completed: 'Completed',
  cancelled: 'Cancelled',
  no_show: 'No-show',
};

/** The status filter's options, in desk order. */
export const STATUS_FILTER_OPTIONS = [
  'Scheduled',
  'In Queue',
  'Completed',
  'Cancelled',
  'No-show',
  'Awaiting payment',
] as const;

export const PAYMENT_LABEL: Readonly<Record<ApptPaymentStatus, string>> = {
  unpaid: 'Pending',
  pending: 'Pending',
  paid: 'Paid',
  refunded: 'Refunded',
  failed: 'Failed',
};

export const SOURCE_LABEL: Readonly<Record<ApptSource, string>> = {
  online: 'Online',
  walk_in: 'Walk-in',
};

/** Desk payment methods offered, in order (the backend accepts more). */
export const DESK_METHODS: readonly PaymentMethod[] = ['cash', 'upi', 'card'];

export const METHOD_LABEL: Readonly<Record<string, string>> = {
  cash: 'Cash',
  upi: 'UPI',
  card: 'Card',
  pos: 'POS',
  netbanking: 'Net banking',
  wallet: 'Wallet',
  emi: 'EMI',
  paylater: 'Pay later',
  other: 'Other',
};

export function methodLabel(method: string): string {
  return METHOD_LABEL[method] ?? method;
}

/** Waiting on the desk's approval before anything else is possible (Q90). */
export function needsApproval(a: DeskAppointment): boolean {
  return a.status === 'pending_approval';
}

/** A walk-in whose fee has not been collected yet (online bookings are prepaid, Q89). */
export function needsPayment(a: DeskAppointment): boolean {
  return (
    a.source === 'walk_in' &&
    (a.paymentStatus === 'unpaid' || a.paymentStatus === 'pending') &&
    a.status !== 'cancelled'
  );
}

export function isInQueue(a: DeskAppointment): boolean {
  return a.status === 'checked_in' || a.status === 'in_consultation';
}

/* ------------------------------------------------------------------- times */

const TIME_FORMAT = new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit' });
const DATE_FORMAT = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' });
const DATE_TIME_FORMAT = new Intl.DateTimeFormat('en-IN', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

function format(fmt: Intl.DateTimeFormat, iso: string | null): string {
  if (!iso) return '—';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '—' : fmt.format(date);
}

/** "9:30 am" from an instant. */
export function timeOf(iso: string): string {
  return format(TIME_FORMAT, iso);
}

/** "13 Jun" from an instant or a `yyyy-mm-dd`. */
export function dayOf(isoOrDay: string): string {
  return format(DATE_FORMAT, isoOrDay.length === ISO_DAY_LENGTH ? `${isoOrDay}T00:00` : isoOrDay);
}

/** "13 Jun 2026, 9:30 am". */
export function dateTimeOf(iso: string | null): string {
  return format(DATE_TIME_FORMAT, iso);
}

/* ------------------------------------------------------------- date windows */

const ISO_DAY_LENGTH = 10;
const WEEK_DAYS = 7;

/** Local `yyyy-mm-dd` of `date`. */
export function localIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return localIso(new Date(y, m - 1, d + days));
}

export type DateWindow = 'Today' | 'Tomorrow' | 'This Week';

export const DATE_WINDOWS: readonly DateWindow[] = ['Today', 'Tomorrow', 'This Week'];

/** The server window for a quick filter or an exact date (exact wins). */
export function rangeFor(window: DateWindow, exact: string, today: string): AppointmentRange {
  if (exact) return { dateFrom: exact, dateTo: exact };
  if (window === 'Tomorrow') {
    const tomorrow = addDays(today, 1);
    return { dateFrom: tomorrow, dateTo: tomorrow };
  }
  if (window === 'This Week') return { dateFrom: today, dateTo: addDays(today, WEEK_DAYS - 1) };
  return { dateFrom: today, dateTo: today };
}

/* ------------------------------------------------------------ row actions */

export type PrimaryKey = 'approve' | 'pay' | 'checkin' | 'receipt' | 'queue';

export interface PrimaryAction {
  readonly key: PrimaryKey;
  readonly label: string;
  readonly icon: IconName;
  readonly variant: 'primary' | 'secondary';
}

/**
 * The permission each row action needs — the same one the backend enforces
 * and the details drawer checks for that action (SEC-13).
 */
export const PRIMARY_ACTION_PERMISSION: Readonly<Record<PrimaryKey, PermissionKey>> = {
  approve: 'Appointments.edit',
  pay: 'Payments.add',
  checkin: 'Appointments.edit',
  queue: 'Token Management.view',
  receipt: 'Payments.view',
};

/** The one next step for an appointment, in the order the desk works. */
export function primaryAction(a: DeskAppointment): PrimaryAction | null {
  if (needsApproval(a)) {
    return { key: 'approve', label: 'Approve', icon: 'check-check', variant: 'primary' };
  }
  if (needsPayment(a)) {
    return { key: 'pay', label: 'Collect', icon: 'indian-rupee', variant: 'primary' };
  }
  if (a.status === 'scheduled') {
    return { key: 'checkin', label: 'Check in', icon: 'log-in', variant: 'primary' };
  }
  if (isInQueue(a)) {
    return { key: 'queue', label: 'Queue', icon: 'ticket', variant: 'secondary' };
  }
  if (a.paymentStatus === 'paid' || a.paymentStatus === 'refunded') {
    return { key: 'receipt', label: 'Receipt', icon: 'receipt', variant: 'secondary' };
  }
  return null;
}

/* ------------------------------------------------------------------ phones */

const INDIA_COUNTRY_CODE = '+91';
const LOCAL_MOBILE_DIGITS = 10;

/** A desk-typed phone as E.164 (10 digits → +91…); empty stays empty. */
export function toE164(phone: string): string {
  const digits = phone.replace(/[^0-9+]/g, '');
  if (!digits) return '';
  if (digits.startsWith('+')) return digits;
  return digits.length === LOCAL_MOBILE_DIGITS ? `${INDIA_COUNTRY_CODE}${digits}` : `+${digits}`;
}
