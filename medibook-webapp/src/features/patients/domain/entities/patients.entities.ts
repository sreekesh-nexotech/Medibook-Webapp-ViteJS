/**
 * Patient records as the hospital API serves them (`HospitalPatient`,
 * `schema.yml`) — identity + contact only; Medibook stores NO clinical data.
 * The record is keyed by `id` (UUID) for the API and by `mrn` for people.
 */

export type PatientGender = 'female' | 'male' | 'other' | 'undisclosed';

/** Where the record was created: at the desk, or by an online booking. */
export type PatientSource = 'desk' | 'online';

export type PatientChangeKind = 'edit' | 'delete';

/** One field an edit request would change: what the record holds now, and what it would hold. */
export interface PatientFieldChange {
  /** API field name, e.g. `phone_e164`. */
  readonly field: string;
  /** Display text of the current value; `null` when unset. */
  readonly before: string | null;
  /** Display text of the proposed value; `null` when it would be cleared. */
  readonly after: string | null;
}

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
  /** Old → new value per changed field (empty for a delete). */
  readonly changes: readonly PatientFieldChange[];
  /** Who asked for it, when the server names them. */
  readonly requestedByName: string | null;
  /** The requester's user id, when the server sends it (to hide Approve on one's own request). */
  readonly requestedByUserId: string | null;
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
  /**
   * The server says the record is this same person's Medibook account
   * (decision 6: link status is disclosed only on a same-person match).
   */
  readonly isLinked: boolean;
  /** How the link was made (`phone_auto`, `booking`, …), when disclosed. */
  readonly linkMethod: string | null;
  readonly linkedAt: string | null;
  readonly pendingChange: PendingPatientChange | null;
  /** Completed consultations here, when the list row carries it (B6); `null` otherwise. */
  readonly completedVisits: number | null;
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
  readonly addressLine2: string | null;
  readonly addressLine3: string | null;
  readonly city: string | null;
  readonly state: string | null;
  /** Six digits. */
  readonly pincode: string | null;
  /** The hospital's number from before Medibook (O-05): searchable, never primary. */
  readonly legacyMrn: string | null;
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

/**
 * A record at this hospital that may be the person being registered: same
 * phone and first name, but a date of birth is missing on one side, so the
 * server cannot confirm it (backend B6, M-14).
 */
export interface PatientMatchCandidate {
  readonly id: string;
  readonly mrn: string;
  readonly fullName: string;
  readonly dateOfBirth: string | null;
  readonly gender: PatientGender | null;
  readonly createdAt: string | null;
}

/**
 * - `created`: a new MRN was minted.
 * - `existing`: the same person already had an MRN here; this is that record.
 * - `matchReview`: possible duplicates the desk must rule on — use one, or
 *   register again with `confirmNewRecord`.
 */
export type PatientCreateOutcome =
  | { readonly status: 'created' | 'existing'; readonly patient: PatientRecord }
  | { readonly status: 'matchReview'; readonly candidates: readonly PatientMatchCandidate[] };

/** What registering a patient sends. */
export interface PatientCreateInput {
  readonly demographics: PatientDemographics;
  /** The desk reviewed the possible matches and wants a new record anyway. */
  readonly confirmNewRecord: boolean;
}

export type PatientEditOutcome =
  | { readonly status: 'applied'; readonly patient: PatientRecord }
  | { readonly status: 'pendingApproval'; readonly requestId: string };

export type PatientDeleteOutcome =
  | { readonly status: 'deleted' }
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

/**
 * `not_required` = a free (₹0) booking; `cancelled` = called off before any
 * money was taken (backend B3).
 */
export type AppointmentPaymentStatus =
  'unpaid' | 'pending' | 'paid' | 'refunded' | 'failed' | 'not_required' | 'cancelled';

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
  readonly kind: PatientChangeKind;
  readonly status: PatientChangeStatus;
  readonly hospitalPatientId: string;
}

/** The record a change request is about, as the approvals queue names it. */
export interface PatientApprovalSubject {
  readonly id: string;
  readonly mrn: string;
  readonly fullName: string;
  /** Soft-deleted since (an approved delete). */
  readonly isDeleted: boolean;
}

/** One row of the patient approvals queue (D-29). */
export interface PatientApproval {
  readonly id: string;
  readonly kind: PatientChangeKind;
  readonly status: PatientChangeStatus;
  readonly patient: PatientApprovalSubject;
  /** Old → new value per changed field (empty for a delete). */
  readonly changes: readonly PatientFieldChange[];
  readonly requestedByName: string | null;
  readonly requestedByUserId: string | null;
  readonly requestedAt: string;
  readonly reviewedByName: string | null;
  readonly reviewedAt: string | null;
  readonly reviewNote: string | null;
}

/** Server filters for the approvals queue. */
export interface PatientApprovalListParams {
  /** One-based. */
  readonly page: number;
  readonly pageSize: number;
  readonly statuses: readonly PatientChangeStatus[];
  readonly kind: PatientChangeKind | null;
}
