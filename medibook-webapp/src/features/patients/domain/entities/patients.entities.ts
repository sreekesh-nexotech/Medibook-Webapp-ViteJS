/**
 * Patient records as the hospital API serves them (`HospitalPatient`,
 * `schema.yml`) — identity + contact only; Medibook stores NO clinical data.
 * The record is keyed by `id` (UUID) for the API and by `mrn` for people.
 */

export type PatientGender = 'female' | 'male' | 'other' | 'undisclosed';

/** Where the record was created: at the desk, or by an online booking. */
export type PatientSource = 'desk' | 'online';

export type PatientChangeKind = 'edit' | 'delete';

/**
 * An edit or delete waiting for an admin (D-29). Only the detail read
 * carries it; list rows always have `null`.
 */
export interface PendingPatientChange {
  readonly id: string;
  readonly kind: PatientChangeKind;
  readonly requestedAt: string;
  /** API field names the change would alter (empty for a delete). */
  readonly changedFields: readonly string[];
}

export interface PatientRecord {
  readonly id: string;
  readonly mrn: string;
  readonly legacyMrn: string | null;
  readonly firstName: string;
  readonly lastName: string | null;
  readonly fullName: string;
  /** E.164, e.g. `+919876543210`. */
  readonly phone: string | null;
  readonly email: string | null;
  /** ISO `yyyy-mm-dd`. */
  readonly dateOfBirth: string | null;
  readonly gender: PatientGender | null;
  readonly addressLine1: string | null;
  readonly addressLine2: string | null;
  readonly addressLine3: string | null;
  readonly city: string | null;
  readonly state: string | null;
  readonly pincode: string | null;
  readonly source: PatientSource;
  /** Linked to a Medibook app account. */
  readonly isLinked: boolean;
  readonly pendingChange: PendingPatientChange | null;
  readonly createdAt: string;
  /** Row version for `If-Match`. */
  readonly version: number;
}

/** The demographic fields the desk can set — what create and edit send. */
export interface PatientDemographics {
  readonly firstName: string;
  readonly lastName: string | null;
  /** E.164. */
  readonly phone: string | null;
  readonly email: string | null;
  readonly dateOfBirth: string | null;
  readonly gender: PatientGender | null;
  readonly addressLine1: string | null;
}

export type PatientSortField = 'full_name' | 'mrn' | 'created_at';

export type SortDirection = 'asc' | 'desc';

export interface PatientListParams {
  /** One-based. */
  readonly page: number;
  readonly pageSize: number;
  /** Name, phone, MRN or legacy MRN. */
  readonly q: string;
  readonly source: PatientSource | null;
  readonly sortField: PatientSortField;
  readonly sortDirection: SortDirection;
}

export interface PatientCreateOutcome {
  readonly patient: PatientRecord;
  /** The same person already had an MRN here; this is that record (no new MRN). */
  readonly isExisting: boolean;
}

export type PatientEditOutcome =
  | { readonly status: 'applied'; readonly patient: PatientRecord }
  | { readonly status: 'pendingApproval'; readonly requestId: string };

export type AppointmentStatus =
  | 'pending_payment'
  | 'pending_approval'
  | 'scheduled'
  | 'checked_in'
  | 'in_consultation'
  | 'completed'
  | 'cancelled'
  | 'no_show';

export type AppointmentSource = 'online' | 'walk_in';

export type AppointmentPaymentStatus = 'unpaid' | 'pending' | 'paid' | 'refunded' | 'failed';

/** One row of a patient's booking history at this hospital. */
export interface PatientAppointment {
  readonly id: string;
  readonly bookingRef: string;
  readonly status: AppointmentStatus;
  readonly source: AppointmentSource;
  readonly doctorName: string;
  readonly departmentName: string;
  /** ISO `yyyy-mm-dd`. */
  readonly scheduledDate: string;
  /** ISO date-time. */
  readonly scheduledStartAt: string;
  readonly tokenLabel: string | null;
  readonly paymentStatus: AppointmentPaymentStatus;
  /** Gross amount incl. tax, in paise. */
  readonly totalPaise: number;
}

export interface PatientAppointmentHistory {
  readonly items: readonly PatientAppointment[];
  /** Every appointment on record, even beyond `items`. */
  readonly total: number;
}

export type PatientChangeStatus = 'pending' | 'approved' | 'rejected';

export interface PatientChangeDecision {
  readonly id: string;
  readonly status: PatientChangeStatus;
  readonly hospitalPatientId: string;
}
