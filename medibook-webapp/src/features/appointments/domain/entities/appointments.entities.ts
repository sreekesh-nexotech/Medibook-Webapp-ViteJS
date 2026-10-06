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

export type ApptPaymentStatus = 'unpaid' | 'pending' | 'paid' | 'refunded' | 'failed';

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
  readonly sessionLabel: string;
  readonly visitId: string | null;
  /** ISO `yyyy-mm-dd` (hospital-local). */
  readonly scheduledDate: string;
  readonly scheduledStartAt: string;
  readonly scheduledEndAt: string;
  readonly tokenLabel: string | null;
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
  /** Integer paise, parsed from what was typed; never a rupee float. */
  readonly amountPaise: number;
  readonly reference: string;
}

export interface NewWalkInPatient {
  readonly firstName: string;
  readonly lastName: string;
  /** E.164. */
  readonly phone: string;
  readonly gender: 'female' | 'male' | 'other' | null;
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

/** A window's appointments, and whether the window held more than were read. */
export interface AppointmentList {
  readonly items: readonly DeskAppointment[];
  /** The page walk stopped before the end: only the first `items` are shown. */
  readonly truncated: boolean;
}
