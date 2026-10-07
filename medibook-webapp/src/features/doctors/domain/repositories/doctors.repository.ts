import type { Result } from '@/core/error/failure';

import type {
  DateExceptionInput,
  Department,
  DepartmentInput,
  DoctorFilters,
  DoctorInput,
  DoctorProfile,
  DoctorReviewPage,
  DoctorScheduleData,
  DoctorScheduleHistory,
  LeaveInput,
  ScheduleChange,
  ScheduleWriteMode,
  WeeklySession,
} from '@/features/doctors/domain/entities/doctors.types';

/** A versioned child row (leave, date exception) a write targets. */
export interface VersionedRef {
  readonly id: string;
  readonly version: number;
}

/**
 * The hospital's doctor & department catalogue. Writes that can cancel
 * bookings take a `ScheduleWriteMode`: a dry run reports the bookings it
 * would cancel; a confirm applies it (cancelling those with a full refund).
 */
export interface DoctorsRepository {
  listDepartments(): Promise<Result<readonly Department[]>>;
  createDepartment(input: DepartmentInput): Promise<Result<Department>>;
  /** `version` is the row the user edited (`If-Match`; UAT-06). */
  updateDepartment(
    id: string,
    input: DepartmentInput,
    version: number,
  ): Promise<Result<Department>>;
  /** Refused with `DEPARTMENT_IN_USE` while doctors are assigned. */
  deleteDepartment(id: string): Promise<Result<null>>;

  listDoctors(filters: DoctorFilters): Promise<Result<readonly DoctorProfile[]>>;
  getDoctor(id: string): Promise<Result<DoctorProfile>>;
  createDoctor(input: DoctorInput): Promise<Result<DoctorProfile>>;
  /** Status/department changes are dry-run unless `confirm`; other edits apply at once. */
  updateDoctor(
    id: string,
    input: DoctorInput,
    version: number,
    mode: ScheduleWriteMode,
  ): Promise<Result<ScheduleChange<DoctorProfile>>>;
  deleteDoctor(id: string, mode: ScheduleWriteMode): Promise<Result<ScheduleChange>>;

  /** A short-lived URL for a doctor's photo file. */
  getPhotoUrl(fileId: string): Promise<Result<string>>;

  /** One page of approved patient reviews (DOC-01). */
  listReviews(doctorId: string, page: number): Promise<Result<DoctorReviewPage>>;

  getSchedule(doctorId: string): Promise<Result<DoctorScheduleData>>;
  /** Every leave entry and date exception, past ones included. */
  getScheduleHistory(doctorId: string): Promise<Result<DoctorScheduleHistory>>;
  replaceWeeklySessions(
    doctorId: string,
    sessions: readonly WeeklySession[],
    version: number,
    mode: ScheduleWriteMode,
  ): Promise<Result<ScheduleChange>>;

  createLeave(
    doctorId: string,
    input: LeaveInput,
    mode: ScheduleWriteMode,
  ): Promise<Result<ScheduleChange>>;
  updateLeave(
    doctorId: string,
    leave: VersionedRef,
    input: LeaveInput,
    mode: ScheduleWriteMode,
  ): Promise<Result<ScheduleChange>>;
  deleteLeave(
    doctorId: string,
    leave: VersionedRef,
    mode: ScheduleWriteMode,
  ): Promise<Result<ScheduleChange>>;

  createDateException(
    doctorId: string,
    input: DateExceptionInput,
    mode: ScheduleWriteMode,
  ): Promise<Result<ScheduleChange>>;
  updateDateException(
    doctorId: string,
    exception: VersionedRef,
    input: DateExceptionInput,
    mode: ScheduleWriteMode,
  ): Promise<Result<ScheduleChange>>;
  deleteDateException(
    doctorId: string,
    exception: VersionedRef,
    mode: ScheduleWriteMode,
  ): Promise<Result<ScheduleChange>>;
}
