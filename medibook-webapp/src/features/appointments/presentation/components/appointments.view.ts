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
  pending_approval: 'Awaiting approval',
  scheduled: 'Scheduled',
  checked_in: 'In Queue',
  in_consultation: 'In Queue',
  completed: 'Completed',
  cancelled: 'Cancelled',
  no_show: 'No-show',
};

/** Widened view for labelling a status that arrives as a plain string (history events). */
const STATUS_LOOKUP: Readonly<Record<string, string | undefined>> = STATUS_LABEL;

/** The label for any status code, e.g. from an event's from/to status. */
export function statusLabelOf(code: string): string {
  return STATUS_LOOKUP[code] ?? code.replace(/_/g, ' ');
}

/** The status filter's options, in desk order. */
export const STATUS_FILTER_OPTIONS = [
  'Awaiting approval',
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

/** A badge: which palette entry to use (`status-map.ts`) and what it says. */
export interface BadgeSpec {
  readonly status: string;
  readonly label: string;
}

/**
 * The payment badge for a row. A booking cancelled before anyone paid keeps
 * `payment_status` pending/unpaid on the backend; showing "Pending" there
 * reads as money still owed, so it says "Not paid" instead.
 */
export function paymentBadge(a: DeskAppointment): BadgeSpec {
  const unpaid = a.paymentStatus === 'unpaid' || a.paymentStatus === 'pending';
  if (unpaid && (a.status === 'cancelled' || a.status === 'no_show')) {
    return { status: 'Inactive', label: 'Not paid' };
  }
  const label = PAYMENT_LABEL[a.paymentStatus];
  return { status: label, label };
}

export const SOURCE_LABEL: Readonly<Record<ApptSource, string>> = {
  online: 'Online',
  walk_in: 'Walk-in',
};

/**
 * Desk payment methods offered, in order. The backend accepts any method and
 * has no per-hospital list (BACKEND_BLOCKERS APPT-03), so the desk gets the
 * ones a counter actually takes: cash, UPI, card, the card machine and other.
 */
export const DESK_METHODS: readonly PaymentMethod[] = ['cash', 'upi', 'card', 'pos', 'other'];

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

/** Statuses after which nothing more is collected. */
const CLOSED_STATUSES: ReadonlySet<ApptStatus> = new Set(['cancelled', 'no_show', 'completed']);

/**
 * A walk-in whose fee is not (or no longer) held: never collected, or
 * refunded while the visit is still on (online bookings are prepaid, Q89).
 * The backend lets a refunded walk-in check in without paying again
 * (BACKEND_BLOCKERS APPT-01), so the desk collects first.
 */
export function needsPayment(a: DeskAppointment): boolean {
  return (
    a.source === 'walk_in' &&
    (a.paymentStatus === 'unpaid' ||
      a.paymentStatus === 'pending' ||
      a.paymentStatus === 'refunded') &&
    !CLOSED_STATUSES.has(a.status)
  );
}

/** Check-in is only possible on the appointment's own date (backend rule). */
export function canCheckIn(a: DeskAppointment, today: string): boolean {
  return a.status === 'scheduled' && a.scheduledDate === today;
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

export type DateWindow = 'Today' | 'Tomorrow' | 'This Week' | 'Yesterday' | 'Last 7 Days';

export const DATE_WINDOWS: readonly DateWindow[] = [
  'Today',
  'Tomorrow',
  'This Week',
  'Yesterday',
  'Last 7 Days',
];

/** The server window for a quick filter or an exact date (exact wins). */
export function rangeFor(window: DateWindow, exact: string, today: string): AppointmentRange {
  if (exact) return { dateFrom: exact, dateTo: exact };
  if (window === 'Tomorrow') {
    const tomorrow = addDays(today, 1);
    return { dateFrom: tomorrow, dateTo: tomorrow };
  }
  if (window === 'This Week') return { dateFrom: today, dateTo: addDays(today, WEEK_DAYS - 1) };
  if (window === 'Yesterday') {
    const yesterday = addDays(today, -1);
    return { dateFrom: yesterday, dateTo: yesterday };
  }
  if (window === 'Last 7 Days')
    return { dateFrom: addDays(today, -WEEK_DAYS), dateTo: addDays(today, -1) };
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
export function primaryAction(a: DeskAppointment, today: string): PrimaryAction | null {
  if (needsApproval(a)) {
    return { key: 'approve', label: 'Approve', icon: 'check-check', variant: 'primary' };
  }
  if (needsPayment(a)) {
    return { key: 'pay', label: 'Collect', icon: 'indian-rupee', variant: 'primary' };
  }
  if (canCheckIn(a, today)) {
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

/* ----------------------------------------------------------------- history */

/** Readable wording for `AppointmentEvent.EventType` (backend `appointment_event.py`). */
const EVENT_LABEL: Readonly<Record<string, string>> = {
  created: 'Booked',
  approval_requested: 'Sent for approval',
  approved: 'Approved',
  checked_in: 'Checked in',
  called: 'Token called',
  started: 'Consultation started',
  completed: 'Consultation completed',
  cancelled: 'Cancelled',
  no_show: 'Marked no-show',
  payment_updated: 'Payment updated',
  refund_updated: 'Refund updated',
  note_added: 'Remark updated',
  reminder_sent: 'Reminder sent',
  token_reassigned: 'Token reassigned',
};

/** Who did it (`AppointmentEvent.ActorKind`). */
const ACTOR_LABEL: Readonly<Record<string, string>> = {
  patient: 'Patient',
  staff: 'Hospital staff',
  system: 'System',
};

export function eventLabel(eventType: string): string {
  return EVENT_LABEL[eventType] ?? eventType.replace(/_/g, ' ');
}

export function actorLabel(actorKind: string): string {
  return ACTOR_LABEL[actorKind] ?? actorKind;
}
