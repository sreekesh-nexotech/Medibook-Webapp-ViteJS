/**
 * Doctors & Departments entities from the hospital API. Plain readonly types
 * — no React, no Axios, no Zod. Fees are integer paise, exactly as the API
 * stores them (UAT-08); `feeRupees` is a display convenience only.
 */

export interface Department {
  readonly id: string;
  /** URL-safe key, unique per hospital (`{DEPT}` in token labels). */
  readonly code: string;
  readonly name: string;
  readonly description: string;
  readonly isActive: boolean;
  readonly sortOrder: number;
  readonly version: number;
}

export type DoctorStatus = 'active' | 'on_leave' | 'inactive';

export interface DoctorProfile {
  readonly id: string;
  readonly departmentId: string;
  readonly slug: string;
  readonly name: string;
  /** Designation shown under the name, e.g. "Consultant"; empty when not set. */
  readonly title: string;
  readonly qualification: string;
  readonly specialisation: string;
  readonly registrationNo: string;
  readonly experienceYears: number | null;
  readonly bio: string;
  readonly photoFileId: string | null;
  /** Consultation fee in paise (₹499.50 = 49950); 0 = a free consultation. */
  readonly feePaise: number;
  /** Follow-up fee in paise, or `null` = a follow-up costs the consultation fee. */
  readonly followUpFeePaise: number | null;
  /** `feePaise` in rupees, for display and sorting only — never sent back. */
  readonly feeRupees: number;
  /** `followUpFeePaise` in rupees, for display only. */
  readonly followUpFeeRupees: number | null;
  /** How long a consultation is expected to take; `null` = the hospital default. */
  readonly expectedConsultMinutes: number | null;
  /** Length of one bookable slot, in minutes (per doctor). */
  readonly slotLengthMin: number;
  readonly room: string;
  readonly status: DoctorStatus;
  readonly isBookableOnline: boolean;
  /** `null` until the first rating. */
  readonly ratingAvg: number | null;
  readonly ratingCount: number;
  /** Starting rating the patient app shows until there are approved reviews (Q76). */
  readonly ratingBase: number | null;
  readonly version: number;
}

/** One named consultation window on a weekday (0 = Monday). */
export interface WeeklySession {
  readonly weekday: number;
  /** `morning` | `afternoon` | `evening` | `custom-N` — unique per weekday. */
  readonly sessionCode: string;
  readonly label: string;
  /** Local wall-clock `HH:MM`. */
  readonly startsAt: string;
  readonly endsAt: string;
}

export type LeaveKind = 'casual' | 'sick' | 'conference' | 'other';

export interface DoctorLeaveEntry {
  readonly id: string;
  readonly kind: LeaveKind;
  /** ISO `yyyy-mm-dd`, inclusive. */
  readonly dateFrom: string;
  readonly dateTo: string;
  readonly reason: string;
  readonly version: number;
}

export interface ExceptionSession {
  readonly sessionCode: string;
  readonly label: string;
  readonly startsAt: string;
  readonly endsAt: string;
}

export interface DoctorDateException {
  readonly id: string;
  /** ISO `yyyy-mm-dd`. */
  readonly date: string;
  /** `closed` = no consultation; `custom_sessions` = these windows instead of the weekly ones. */
  readonly kind: 'closed' | 'custom_sessions';
  readonly note: string;
  readonly sessions: readonly ExceptionSession[];
  readonly version: number;
}

/** A doctor's whole leave and date-exception record, past entries included. */
export interface DoctorScheduleHistory {
  readonly leaves: readonly DoctorLeaveEntry[];
  readonly dateExceptions: readonly DoctorDateException[];
}

/** Everything the Availability tab edits, from one `GET /doctors/{id}/schedule`. */
export interface DoctorScheduleData {
  readonly doctorId: string;
  /** The doctor's row version — `If-Match` for the weekly-sessions replace. */
  readonly version: number;
  readonly slotLengthMin: number;
  readonly weeklySessions: readonly WeeklySession[];
  readonly leaves: readonly DoctorLeaveEntry[];
  readonly dateExceptions: readonly DoctorDateException[];
  /** The next 14 days as the backend resolves them (holidays, leave, exceptions, weekly). */
  readonly upcoming: readonly ResolvedDay[];
}

/** Why a date has the sessions it has, as the backend resolved it. */
export type ResolvedSource =
  'weekly' | 'holiday' | 'leave' | 'exception_closed' | 'exception_custom_sessions' | 'inactive';

/** One date of the backend's resolved schedule. */
export interface ResolvedDay {
  /** ISO `yyyy-mm-dd`. */
  readonly date: string;
  readonly source: ResolvedSource | string;
  readonly sessions: readonly ExceptionSession[];
}

/** A booking a schedule change would cancel (with a full refund) once confirmed. */
export interface AffectedBooking {
  readonly appointmentId: string;
  readonly bookingRef: string;
  /** `null` for a booking without a token yet (the backend allows it). */
  readonly tokenLabel: string | null;
  readonly patientName: string;
  readonly scheduledStartAt: string;
}

/**
 * The answer to every write that can touch bookings. `dryRun: true` means
 * nothing was applied — `affectedBookings` lists what confirming would cancel.
 */
export interface ScheduleChange<T = null> {
  readonly dryRun: boolean;
  readonly affectedBookings: readonly AffectedBooking[];
  /**
   * Bookings already in consultation or completed in the changed time —
   * kept, never cancelled (L-21); empty from an older backend.
   */
  readonly notCancellableBookings: readonly AffectedBooking[];
  /** The written record when the change was applied and the API returns one. */
  readonly result: T | null;
  /**
   * A dry run's fingerprint of what it previewed, sent back on confirm so the
   * server can refuse when the affected bookings changed in between (BE-33);
   * `null` from a backend that does not issue one.
   */
  readonly previewToken: string | null;
  /** The applied change queued a background slot re-generation (the grid catches up shortly). */
  readonly rematerialisationQueued: boolean;
}

/**
 * How one booking-affecting write is sent (Q32, Q73, D-21). Every such write
 * carries an `Idempotency-Key`: a fresh one for each dry run, and one per
 * confirmed user action that is reused if the confirm is retried.
 */
export interface ScheduleWriteMode {
  /** `false` = dry run (nothing is applied); `true` = apply. */
  readonly confirm: boolean;
  readonly idempotencyKey: string;
  /** The dry run's `previewToken`, on confirm only. */
  readonly previewToken?: string | null;
}

export interface DepartmentInput {
  readonly name: string;
  readonly description: string;
  readonly isActive: boolean;
  /**
   * The code only when the user typed one. Omitted, the server makes it from
   * the name (BE-33) and an edit keeps the stored code (UAT-49).
   */
  readonly code?: string;
}

export interface DoctorInput {
  readonly name: string;
  readonly title: string;
  readonly departmentId: string;
  readonly specialisation: string;
  readonly qualification: string;
  readonly registrationNo: string;
  readonly experienceYears: number | null;
  readonly bio: string;
  readonly room: string;
  /** Integer paise; 0 is a free consultation (the backend allows ≥ 0). */
  readonly feePaise: number;
  /** `null` = a follow-up costs the consultation fee. */
  readonly followUpFeePaise: number | null;
  /** `null` = the hospital's default consultation time. */
  readonly expectedConsultMinutes: number | null;
  readonly slotLengthMin: number;
  readonly isBookableOnline: boolean;
  readonly status: DoctorStatus;
  readonly photoFileId: string | null;
  /** Only when the user typed one; the server makes it from the name otherwise (BE-33, UAT-49). */
  readonly slug?: string;
}

export interface LeaveInput {
  readonly kind: LeaveKind;
  readonly dateFrom: string;
  readonly dateTo: string;
  readonly reason: string;
}

export interface DateExceptionInput {
  readonly date: string;
  readonly kind: 'closed' | 'custom_sessions';
  readonly note: string;
  readonly sessions: readonly ExceptionSession[];
}

export interface DoctorFilters {
  readonly search?: string;
  readonly departmentId?: string;
  readonly status?: DoctorStatus;
}

/** An approved patient review of a doctor (`GET /hospital/doctors/{id}/reviews`, DOC-01). */
export interface DoctorReview {
  readonly id: string;
  /** 1–5. */
  readonly rating: number;
  readonly comment: string;
  /** ISO date-time the patient wrote it. */
  readonly reviewedAt: string | null;
  /** "A.R." — reviews never name the patient in full. */
  readonly patientInitials: string | null;
}

/** One page of a doctor's reviews. */
export interface DoctorReviewPage {
  readonly items: readonly DoctorReview[];
  readonly total: number;
  readonly hasNext: boolean;
}
