import type { PermissionKey } from '@/shared/hooks/usePermission';
import {
  addIsoDays,
  formatDateTimeIn,
  formatDayIn,
  formatTimeIn,
  isInstantOver,
} from '@/shared/lib/hospitalTime';
import type { IconName } from '@/shared/ui/icon-registry';

import type { Failure } from '@/core/error/failure';

import type {
  AppointmentRange,
  ApptPaymentStatus,
  ApptSource,
  ApptStatus,
  DeskAppointment,
  PaymentMethod,
} from '@/features/appointments/domain/entities/appointments.entities';
import type { AppointmentTab } from '@/features/appointments/domain/appointments.listFilters';

/**
 * View-model helpers for the desk appointment screens: badge labels,
 * hospital-local times, the list's date windows, which actions a booking
 * allows and the desk's wording for backend refusals. Pure, no React.
 */

/* ------------------------------------------------------------------ labels */

/** What each backend status reads as on the desk. */
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

/**
 * The palette entry (`status-map.ts`) each status label is drawn with, so
 * statuses the shared map does not name get a fitting colour instead of the
 * "Scheduled" fallback (03 F14).
 */
const STATUS_PALETTE: Readonly<Record<string, string>> = {
  'Awaiting payment': 'Pending',
  'Awaiting approval': 'Pending verification',
};

/** A badge: which palette entry to use (`status-map.ts`) and what it says. */
export interface BadgeSpec {
  readonly status: string;
  readonly label: string;
}

export function statusBadge(status: ApptStatus): BadgeSpec {
  const label = STATUS_LABEL[status];
  return { status: STATUS_PALETTE[label] ?? label, label };
}

/** Widened view for labelling a status that arrives as a plain string (history events). */
const STATUS_LOOKUP: Readonly<Record<string, string | undefined>> = STATUS_LABEL;

/** The label for any status code, e.g. from an event's from/to status. */
export function statusLabelOf(code: string): string {
  return STATUS_LOOKUP[code] ?? code.replace(/_/g, ' ');
}

export const PAYMENT_LABEL: Readonly<Record<ApptPaymentStatus, string>> = {
  unpaid: 'Pending',
  pending: 'Pending',
  paid: 'Paid',
  refunded: 'Refunded',
  failed: 'Failed',
  not_required: 'Nothing due',
  cancelled: 'Not paid',
};

export const SOURCE_LABEL: Readonly<Record<ApptSource, string>> = {
  online: 'Online',
  walk_in: 'Walk-in',
};

/** The source badge: online bookings arrive through Medibook. */
export function sourceBadge(source: ApptSource): BadgeSpec {
  return source === 'online'
    ? { status: 'Medibook', label: SOURCE_LABEL.online }
    : { status: 'Walk-in', label: SOURCE_LABEL.walk_in };
}

/**
 * Desk payment methods offered, in order: the backend's default
 * `desk_payment_methods` (APPT-03). A hospital that takes fewer gets a
 * `VALIDATION_ERROR` naming the methods it accepts, which `deskErrorText`
 * turns into a sentence.
 */
export const DESK_METHODS: readonly PaymentMethod[] = ['cash', 'upi', 'card', 'pos', 'other'];

const KNOWN_METHODS: ReadonlySet<string> = new Set<PaymentMethod>([
  'cash',
  'upi',
  'card',
  'pos',
  'netbanking',
  'wallet',
  'other',
]);

function isPaymentMethod(value: unknown): value is PaymentMethod {
  return typeof value === 'string' && KNOWN_METHODS.has(value);
}

/**
 * The desk methods a refusal says the hospital accepts (B3
 * `meta.accepted_methods`), so Collect can offer only those; `null` when the
 * refusal does not say.
 */
export function acceptedMethodsOf(failure: Failure): readonly PaymentMethod[] | null {
  const accepted = failure.meta.accepted_methods;
  if (!Array.isArray(accepted)) return null;
  const methods = accepted.filter(isPaymentMethod);
  return methods.length > 0 ? methods : null;
}

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

/* ------------------------------------------------------------ what applies */

/** Waiting on the desk's approval before anything else is possible (Q90). */
export function needsApproval(a: DeskAppointment): boolean {
  return a.status === 'pending_approval';
}

/** Statuses after which nothing more is collected or done. */
const CLOSED_STATUSES: ReadonlySet<ApptStatus> = new Set(['cancelled', 'no_show', 'completed']);

export function isClosed(a: DeskAppointment): boolean {
  return CLOSED_STATUSES.has(a.status);
}

const UNSETTLED: ReadonlySet<ApptPaymentStatus> = new Set(['unpaid', 'pending', 'refunded']);

/**
 * Nothing is owed (UAT-12): a ₹0 walk-in (free follow-up, a doctor without a
 * fee). The backend marks it `not_required` (BE-07); an older one leaves it
 * `unpaid` with a zero total.
 */
export function isNothingDue(a: DeskAppointment): boolean {
  return (
    a.paymentStatus === 'not_required' ||
    (a.totalRupees === 0 && (a.paymentStatus === 'unpaid' || a.paymentStatus === 'pending'))
  );
}

/**
 * A walk-in whose fee is not (or no longer) held: never collected, or
 * refunded while the visit is still on (online bookings are prepaid, Q89).
 * A ₹0 walk-in owes nothing and is never "pending payment".
 */
export function needsPayment(a: DeskAppointment): boolean {
  return (
    a.source === 'walk_in' && UNSETTLED.has(a.paymentStatus) && !isNothingDue(a) && !isClosed(a)
  );
}

/**
 * Check-in is possible on the appointment's own hospital-local day once
 * nothing is owed: paid, ₹0, or prepaid online (the backend refuses an
 * unpaid walk-in — UAT-12, UAT-45).
 */
export function canCheckIn(a: DeskAppointment, today: string): boolean {
  return a.status === 'scheduled' && a.scheduledDate === today && !needsPayment(a);
}

export function isInQueue(a: DeskAppointment): boolean {
  return a.status === 'checked_in' || a.status === 'in_consultation';
}

/**
 * A no-show only for a booking still waiting (scheduled or checked in), never
 * ahead of its day (UAT-13): on an earlier day it closes out an absentee; on
 * the day itself only once its slot has started or its token was called —
 * the backend's own rule (`NO_SHOW_TOO_EARLY`, BE-08).
 */
export function canMarkNoShow(a: DeskAppointment, today: string, now: number): boolean {
  if (a.status !== 'scheduled' && a.status !== 'checked_in') return false;
  if (a.scheduledDate > today) return false;
  if (a.scheduledDate < today) return true;
  return a.calledAt !== null || isInstantOver(a.scheduledStartAt, now);
}

/** The hospital may cancel until the consultation starts (`cancellation.CANCELLABLE`). */
export function canCancel(a: DeskAppointment): boolean {
  return (
    a.status === 'pending_payment' ||
    a.status === 'pending_approval' ||
    a.status === 'scheduled' ||
    a.status === 'checked_in'
  );
}

/** Money was taken for this booking (a refund or a cancel would hand it back). */
export function hasPaid(a: DeskAppointment): boolean {
  return a.paymentStatus === 'paid';
}

/**
 * How the desk returns money (B3): a booking that is over (completed,
 * no-show, cancelled) and still paid is refunded; a live paid booking is
 * cancelled with a full refund in one step — a refund on it is refused with
 * `REFUND_REQUIRES_CANCEL`.
 */
export function moneyBackAction(a: DeskAppointment): 'refund' | 'cancel-refund' | null {
  if (!hasPaid(a)) return null;
  if (isClosed(a)) return 'refund';
  return canCancel(a) ? 'cancel-refund' : null;
}

/** The token slip exists for a booking that holds its token (not at checkout, not cancelled). */
export function hasTokenSlip(a: DeskAppointment): boolean {
  return a.tokenLabel !== null && a.status !== 'pending_payment' && a.status !== 'cancelled';
}

/* ---------------------------------------------------------------- reason copy */

export type ReasonKind = 'cancel' | 'reject' | 'refund';

export interface ReasonCopy {
  readonly title: string;
  readonly body: string;
  readonly confirm: string;
}

/**
 * What the reason prompt says. Cancel and reject promise a refund only when
 * something was paid (03 F16); a hospital cancel is always 100 % (Q11), so
 * the amount is the booking's total.
 */
export function reasonCopy(kind: ReasonKind, a: DeskAppointment, total: string): ReasonCopy {
  const paid = hasPaid(a);
  if (kind === 'refund') {
    return {
      title: 'Refund Payment',
      body: `${total} is refunded in full — one refund per payment line, to its original method. Cash is handed back from your open cash drawer; online refunds show as pending until the gateway confirms them.`,
      confirm: 'Refund in full',
    };
  }
  const action = kind === 'cancel' ? 'cancelled' : 'rejected';
  return {
    title: kind === 'cancel' ? 'Cancel Appointment' : 'Reject Booking',
    body: paid
      ? `The booking is ${action} and the patient is refunded ${total} in full — including any convenience fee — to the original payment method. Cash is handed back from your open cash drawer. This cannot be undone.`
      : `The booking is ${action} and its slot is freed. Nothing was paid, so there is nothing to refund. This cannot be undone.`,
    confirm: paid
      ? kind === 'cancel'
        ? 'Cancel & refund'
        : 'Reject & refund'
      : kind === 'cancel'
        ? 'Cancel booking'
        : 'Reject booking',
  };
}

/* ---------------------------------------------------------- desk refusals */

const SLOT_REFUSALS: Readonly<Record<string, string>> = {
  SLOT_TAKEN: 'That time was just taken by another booking — pick another slot.',
  SLOT_CLOSED:
    'That slot is no longer open — it was blocked or the doctor’s session has closed. Pick another.',
  SLOT_IN_PAST: 'That slot has already ended — pick a later one.',
  SLOT_BEYOND_WINDOW: 'That date is beyond the hospital’s booking window.',
  SLOT_UNAVAILABLE: 'That slot can no longer be booked — pick another time.',
};

/** Codes that mean "pick another slot"; the picker refreshes after them. */
export function isSlotRefusal(failure: Failure): boolean {
  return failure.code !== null && failure.code in SLOT_REFUSALS;
}

const DESK_REFUSALS: Readonly<Record<string, string>> = {
  CASH_SESSION_REQUIRED:
    'Open your cash drawer on the Payments screen first — cash is taken into, or handed back from, your own drawer.',
  REFUND_REQUIRES_CANCEL:
    'This booking is still on. Cancel it to refund the patient — a hospital cancel refunds in full.',
  IDEMPOTENCY_CONFLICT:
    'This was already sent with different details. Refresh the list to see what was recorded.',
};

/** The first message the server attached to a field, if any. */
function firstFieldMessage(failure: Failure): string | null {
  for (const messages of Object.values(failure.fieldErrors)) {
    if (messages.length > 0) return messages[0];
  }
  return null;
}

/**
 * A desk-safe sentence for a refused action: distinct wording for each slot
 * refusal (UAT-18) with the consultation it concerns, the drawer and refund
 * rules, the hospital's accepted payment methods, else the server's own
 * curated message.
 */
export function deskErrorText(failure: Failure, fallback: string): string {
  if (failure.code && SLOT_REFUSALS[failure.code]) {
    const index = failure.meta.index;
    const prefix = typeof index === 'number' ? `Consultation ${index + 1}: ` : '';
    return `${prefix}${SLOT_REFUSALS[failure.code]}`;
  }
  if (failure.code && DESK_REFUSALS[failure.code]) return DESK_REFUSALS[failure.code];
  const accepted = failure.meta.accepted_methods;
  if (Array.isArray(accepted) && accepted.length > 0) {
    const names = accepted.filter((m): m is string => typeof m === 'string').map(methodLabel);
    return `This hospital takes ${names.join(', ')} at the desk.`;
  }
  if (failure.kind === 'validation') return firstFieldMessage(failure) ?? failure.message;
  return failure.message || fallback;
}

/* ------------------------------------------------------------------- times */

/** "9:30 am" in the hospital's zone (UAT-47). */
export function timeOf(iso: string, timeZone: string): string {
  return formatTimeIn(iso, timeZone);
}

/** "13 Jun" from an instant (in the hospital's zone) or a plain `yyyy-mm-dd`. */
export function dayOf(isoOrDay: string, timeZone: string): string {
  return formatDayIn(isoOrDay, timeZone);
}

/** "13 Jun 2026, 9:30 am" in the hospital's zone. */
export function dateTimeOf(iso: string | null, timeZone: string): string {
  return formatDateTimeIn(iso, timeZone);
}

/* ------------------------------------------------------------- date windows */

const WEEK_DAYS = 7;

/** "Upcoming" reaches past any booking window a hospital sets (default 30 days, Q69). */
const UPCOMING_DAYS = 365;

export type DateWindow =
  'Today' | 'Tomorrow' | 'This Week' | 'Upcoming' | 'Yesterday' | 'Last 7 Days';

export const DATE_WINDOWS: readonly DateWindow[] = [
  'Today',
  'Tomorrow',
  'This Week',
  'Upcoming',
  'Yesterday',
  'Last 7 Days',
];

/**
 * The date window a tab opens on. Approval requests are for coming days, so
 * "Needs Approval" shows every upcoming one — from the tab as from the
 * dashboard link (BE-26); a request booked for tomorrow was invisible under
 * "Today" (UAT A-13). Other tabs keep the window the desk chose.
 */
export function windowForTab(tab: AppointmentTab, current: DateWindow): DateWindow {
  return tab === 'Needs Approval' ? 'Upcoming' : current;
}

export function isDateWindow(value: string): value is DateWindow {
  return (DATE_WINDOWS as readonly string[]).includes(value);
}

/** The server window for a quick filter or an exact date (exact wins); `today` is hospital-local. */
export function rangeFor(window: DateWindow, exact: string, today: string): AppointmentRange {
  if (exact) return { dateFrom: exact, dateTo: exact };
  if (window === 'Tomorrow') {
    const tomorrow = addIsoDays(today, 1);
    return { dateFrom: tomorrow, dateTo: tomorrow };
  }
  if (window === 'This Week') return { dateFrom: today, dateTo: addIsoDays(today, WEEK_DAYS - 1) };
  if (window === 'Upcoming') return { dateFrom: today, dateTo: addIsoDays(today, UPCOMING_DAYS) };
  if (window === 'Yesterday') {
    const yesterday = addIsoDays(today, -1);
    return { dateFrom: yesterday, dateTo: yesterday };
  }
  if (window === 'Last 7 Days')
    return { dateFrom: addIsoDays(today, -WEEK_DAYS), dateTo: addIsoDays(today, -1) };
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

/**
 * The one next step for an appointment, in the order the desk works. For a
 * role that cannot collect (department front desk), an unpaid walk-in's next
 * step is reception's, so it gets none here (UAT-45).
 */
export function primaryAction(
  a: DeskAppointment,
  today: string,
  canCollect = true,
): PrimaryAction | null {
  if (needsApproval(a)) {
    return { key: 'approve', label: 'Approve', icon: 'check-check', variant: 'primary' };
  }
  if (needsPayment(a)) {
    return canCollect
      ? { key: 'pay', label: 'Collect', icon: 'indian-rupee', variant: 'primary' }
      : null;
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

/**
 * The payment badge for a row. A booking cancelled before anyone paid keeps
 * an unsettled status on older backends; showing "Pending" there reads as
 * money still owed, so it says "Not paid" instead. A ₹0 walk-in says
 * "Nothing due".
 */
export function paymentBadge(a: DeskAppointment): BadgeSpec {
  if (isNothingDue(a)) return { status: 'Inactive', label: PAYMENT_LABEL.not_required };
  const unsettled = a.paymentStatus === 'unpaid' || a.paymentStatus === 'pending';
  if (a.paymentStatus === 'cancelled' || (unsettled && isClosed(a))) {
    return { status: 'Inactive', label: PAYMENT_LABEL.cancelled };
  }
  const label = PAYMENT_LABEL[a.paymentStatus];
  return { status: label, label };
}
