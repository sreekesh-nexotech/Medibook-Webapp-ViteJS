/**
 * Doctors & Departments entities from the hospital API. Plain readonly types
 * — no React, no Axios, no Zod. Fees are whole rupees here; the paise the
 * API uses never leave the infrastructure layer.
 */

export interface Department {
  readonly id: string;
  /** URL-safe key, unique per hospital (derived from the name on create). */
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
  readonly qualification: string;
  readonly specialisation: string;
  readonly registrationNo: string;
  readonly experienceYears: number | null;
  readonly bio: string;
  readonly photoFileId: string | null;
  /** Consultation fee in whole rupees. */
  readonly feeRupees: number;
  /** Fee for a follow-up visit within the hospital's window; `null` = the consultation fee. */
  readonly followUpFeeRupees: number | null;
  /** Length of one bookable slot, in minutes (per doctor). */
  readonly slotLengthMin: number;
  readonly room: string;
  readonly status: DoctorStatus;
  readonly isBookableOnline: boolean;
  /** `null` until the first rating. */
  readonly ratingAvg: number | null;
  readonly ratingCount: number;
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

/** Everything the Availability tab edits, from one `GET /doctors/{id}/schedule`. */
export interface DoctorScheduleData {
  readonly doctorId: string;
  /** The doctor's row version — `If-Match` for the weekly-sessions replace. */
  readonly version: number;
  readonly slotLengthMin: number;
  readonly weeklySessions: readonly WeeklySession[];
  readonly leaves: readonly DoctorLeaveEntry[];
  readonly dateExceptions: readonly DoctorDateException[];
}

/** A booking a schedule change would cancel (with a full refund) once confirmed. */
export interface AffectedBooking {
  readonly appointmentId: string;
  readonly bookingRef: string;
  /** `null` when the booking has no token yet. */
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
  /** The written record when the change was applied and the API returns one. */
  readonly result: T | null;
}

export interface DepartmentInput {
  readonly name: string;
  readonly description: string;
  readonly isActive: boolean;
}

export interface DoctorInput {
  readonly name: string;
  readonly departmentId: string;
  readonly specialisation: string;
  readonly qualification: string;
  readonly registrationNo: string;
  readonly experienceYears: number | null;
  readonly bio: string;
  readonly room: string;
  readonly feeRupees: number;
  /** `null` charges the consultation fee for follow-ups too. */
  readonly followUpFeeRupees: number | null;
  /** Whether patients can book this doctor in the Medibook app. */
  readonly isBookableOnline: boolean;
  readonly status: DoctorStatus;
  readonly photoFileId: string | null;
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
