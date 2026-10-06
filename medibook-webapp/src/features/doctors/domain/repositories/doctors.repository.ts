import type { Result } from '@/core/error/failure';

import type {
  DateExceptionInput,
  Department,
  DepartmentInput,
  DoctorFilters,
  DoctorInput,
  DoctorProfile,
  DoctorScheduleData,
  LeaveInput,
  ScheduleChange,
  WeeklySession,
} from '@/features/doctors/domain/entities/doctors.types';

/**
 * The hospital's doctor & department catalogue. Writes that can cancel
 * bookings take `confirm`: `false` is a dry run that reports the bookings it
 * would cancel, `true` applies it (cancelling those with a full refund).
 */
export interface DoctorsRepository {
  listDepartments(): Promise<Result<readonly Department[]>>;
  createDepartment(input: DepartmentInput): Promise<Result<Department>>;
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
    confirm: boolean,
  ): Promise<Result<ScheduleChange<DoctorProfile>>>;
  deleteDoctor(id: string, confirm: boolean): Promise<Result<ScheduleChange>>;

  /** A short-lived URL for a doctor's photo file. */
  getPhotoUrl(fileId: string): Promise<Result<string>>;

  getSchedule(doctorId: string): Promise<Result<DoctorScheduleData>>;
  replaceWeeklySessions(
    doctorId: string,
    sessions: readonly WeeklySession[],
    version: number,
    confirm: boolean,
  ): Promise<Result<ScheduleChange>>;

  createLeave(
    doctorId: string,
    input: LeaveInput,
    confirm: boolean,
  ): Promise<Result<ScheduleChange>>;
  updateLeave(
    doctorId: string,
    leaveId: string,
    input: LeaveInput,
    version: number,
    confirm: boolean,
  ): Promise<Result<ScheduleChange>>;
  deleteLeave(
    doctorId: string,
    leaveId: string,
    confirm: boolean,
    version: number,
  ): Promise<Result<ScheduleChange>>;

  createDateException(
    doctorId: string,
    input: DateExceptionInput,
    confirm: boolean,
  ): Promise<Result<ScheduleChange>>;
  updateDateException(
    doctorId: string,
    exceptionId: string,
    input: DateExceptionInput,
    version: number,
    confirm: boolean,
  ): Promise<Result<ScheduleChange>>;
  deleteDateException(
    doctorId: string,
    exceptionId: string,
    confirm: boolean,
    version: number,
  ): Promise<Result<ScheduleChange>>;
}
