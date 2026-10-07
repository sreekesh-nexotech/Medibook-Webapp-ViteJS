/**
 * Desk appointments as the hospital API serves them. Plain readonly types.
 * Money is whole rupees here; the paise the API uses never leave the
 * infrastructure layer. No clinical data — Medibook stores none.
 */

export type ApptStatus =
  | 'pending_payment'
  | 'pending_approval'
  | 'scheduled'
  | 'checked_in'
  | 'in_consultation'
  | 'completed'
  | 'cancelled'
  | 'no_show';

/**
 * `not_required` (BE-07, UAT-12): a ₹0 walk-in has nothing to collect — an
 * older backend leaves it `unpaid`, so read `isNothingDue`. `cancelled`
 * (APPT-02): cancelled or expired before any money was taken.
 */
export type ApptPaymentStatus =
  'unpaid' | 'pending' | 'paid' | 'refunded' | 'failed' | 'not_required' | 'cancelled';

export type ApptSource = 'online' | 'walk_in';

export interface ApptPatient {
  readonly id: string;
  readonly mrn: string;
  readonly fullName: string;
  readonly phone: string | null;
  readonly gender: string | null;
  readonly dateOfBirth: string | null;
}

export interface DeskAppointment {
  readonly id: string;
  readonly bookingRef: string;
  readonly status: ApptStatus;
  readonly statusReason: string | null;
  readonly source: ApptSource;
  /** `null` only for records whose patient is no longer readable. */
  readonly patient: ApptPatient | null;
  readonly doctor: { readonly id: string; readonly name: string; readonly room: string | null };
  readonly department: { readonly id: string; readonly name: string };
  /** The doctor session (the queue) the booking sits in. */
  readonly sessionId: string;
  readonly sessionLabel: string;
  /** The session's lifecycle (`scheduled`, `open`, `paused`, `closed`, `cancelled`), when sent. */
  readonly sessionStatus: string | null;
  /** The priced service, if the booking carries one. */
  readonly serviceId: string | null;
  readonly visitId: string | null;
  /** ISO `yyyy-mm-dd` (hospital-local). */
  readonly scheduledDate: string;
  readonly scheduledStartAt: string;
  readonly scheduledEndAt: string;
  readonly tokenLabel: string | null;
  /** Queue position: the backend calls strictly by token number (Q25). */
  readonly tokenNo: number | null;
  /** Set once the token has been called (a skipped token keeps it). */
  readonly calledAt: string | null;
  /** How many times the desk skipped this token (Q27). */
  readonly noShowAttempts: number;
  readonly consultationStartedAt: string | null;
  readonly isFollowUp: boolean;
  readonly patientNotes: string;
  readonly remark: string;
  readonly paymentStatus: ApptPaymentStatus;
  readonly consultationRupees: number;
  readonly serviceRupees: number;
  readonly discountRupees: number;
  readonly convenienceRupees: number;
  readonly taxRupees: number;
  readonly totalRupees: number;
  readonly approvedAt: string | null;
  readonly checkedInAt: string | null;
  readonly completedAt: string | null;
  readonly cancelledAt: string | null;
  readonly cancellationReason: string | null;
  readonly noShowAt: string | null;
  readonly createdAt: string;
  /** Row version for `If-Match`. */
  readonly version: number;
}

/** One entry of an appointment's append-only history. */
export interface AppointmentEvent {
  readonly id: string;
  readonly eventType: string;
  readonly actorKind: string;
  /** Who did it by name, when the backend sends it (APPT-04). */
  readonly actorName: string | null;
  readonly fromStatus: string | null;
  readonly toStatus: string | null;
  readonly occurredAt: string;
}

export interface ReceiptLine {
  readonly description: string;
  readonly bookingRef: string;
  readonly amountRupees: number;
  readonly taxRupees: number;
  readonly taxRatePercent: number;
  readonly taxInclusive: boolean;
}

export type PaymentMethod = 'cash' | 'upi' | 'card' | 'pos' | 'netbanking' | 'wallet' | 'other';

export interface ReceiptPayment {
  readonly method: string;
  readonly amountRupees: number;
  readonly reference: string | null;
}

export interface DeskReceipt {
  readonly id: string;
  readonly receiptNo: string;
  readonly issuedAt: string;
  readonly issuedByName: string | null;
  readonly counterCode: string | null;
  readonly hospitalName: string;
  readonly hospitalGstin: string | null;
  readonly lines: readonly ReceiptLine[];
  readonly payments: readonly ReceiptPayment[];
  readonly subtotalRupees: number;
  readonly taxRupees: number;
  readonly totalRupees: number;
  readonly hasPdf: boolean;
}

/**
 * Refund lifecycle (`Refund.Status`): a gateway refund is `requested` /
 * `processing` until confirmed; `superseded` is a failed row replaced by a
 * later refund of the same line.
 */
export type RefundStatus = 'requested' | 'processing' | 'processed' | 'failed' | 'superseded';

/** One refund row — one per payment line, always in full (Q94, Q95). */
export interface DeskRefund {
  readonly id: string;
  readonly amountRupees: number;
  readonly status: RefundStatus;
  readonly method: string | null;
}

/** A cancel or reject: the booking as it now stands and the refunds it started. */
export interface RefundOutcome {
  readonly appointment: DeskAppointment;
  readonly refunds: readonly DeskRefund[];
}

export interface TokenSlipData {
  readonly hospitalName: string;
  readonly tokenLabel: string;
  readonly bookingRef: string;
  readonly mrn: string;
  readonly patientName: string;
  readonly doctorName: string;
  readonly doctorRoom: string | null;
  readonly departmentName: string;
  readonly sessionLabel: string;
  readonly scheduledStartAt: string;
}

export interface PaymentLineInput {
  readonly method: PaymentMethod;
  readonly amountRupees: number;
  readonly reference: string;
}

export interface NewWalkInPatient {
  readonly firstName: string;
  readonly lastName: string;
  /** E.164. */
  readonly phone: string;
  readonly gender: 'female' | 'male' | 'other' | 'undisclosed' | null;
  /** ISO `yyyy-mm-dd`, optional. */
  readonly dateOfBirth: string | null;
}

export type WalkInPatient =
  | { readonly kind: 'existing'; readonly hospitalPatientId: string }
  | { readonly kind: 'new'; readonly patient: NewWalkInPatient };

export interface WalkInConsultation {
  readonly departmentId: string;
  readonly doctorId: string;
  /** An open slot of that doctor — every walk-in consultation needs one (Q74). */
  readonly slotId: string;
  /** An optional priced service for this consultation (APPT-06). */
  readonly serviceId: string | null;
}

export interface WalkInInput {
  readonly patient: WalkInPatient;
  readonly consultations: readonly WalkInConsultation[];
  readonly remark: string;
}

export interface WalkInResult {
  readonly visitId: string;
  readonly appointments: readonly DeskAppointment[];
}

/** The appointment list's server-side window (hospital-local dates, inclusive). */
export interface AppointmentRange {
  readonly dateFrom: string;
  readonly dateTo: string;
}

/** Server sorts the desk list supports (`GET /hospital/appointments?sort=`). */
export type AppointmentSortField = 'scheduled_start_at' | 'token_no' | 'created_at' | 'booking_ref';

export interface AppointmentSort {
  readonly field: AppointmentSortField;
  readonly direction: 'asc' | 'desc';
}

/**
 * One page of the desk list, filtered and sorted by the server — every
 * filter is one the backend allowlists (`hospital_appointment_list.py`).
 * Empty `statuses` = any status.
 */
export interface AppointmentListParams extends AppointmentRange {
  readonly statuses: readonly ApptStatus[];
  readonly source: ApptSource | null;
  readonly paymentStatus: ApptPaymentStatus | null;
  readonly departmentId: string | null;
  readonly doctorId: string | null;
  readonly q: string;
  readonly sort: AppointmentSort;
  readonly page: number;
  readonly pageSize: number;
}

/** A page of desk appointments. */
export interface AppointmentPage {
  readonly items: readonly DeskAppointment[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
}

/** One consultation to price before booking (`POST /hospital/appointments/quote`, APPT-05). */
export interface QuoteConsultationInput {
  readonly doctorId: string;
  /** The chosen slot (its date prices follow-ups), when picked. */
  readonly slotId: string | null;
  readonly serviceId: string | null;
  /** Hospital-local day of the visit, used until a slot is picked. */
  readonly date: string;
}

export interface QuoteInput {
  /** An existing patient (follow-up pricing); a new patient is never a follow-up. */
  readonly hospitalPatientId: string | null;
  readonly consultations: readonly QuoteConsultationInput[];
}

/** What one consultation would cost, exactly as the booking would snapshot it. */
export interface QuotedConsultation {
  readonly index: number;
  readonly isFollowUp: boolean;
  readonly consultationRupees: number;
  readonly serviceRupees: number;
  readonly discountRupees: number;
  readonly taxRupees: number;
  readonly totalRupees: number;
}

export interface FeeQuote {
  readonly consultations: readonly QuotedConsultation[];
  readonly totalRupees: number;
}
