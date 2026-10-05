import { z } from 'zod';

import type {
  AffectedBooking,
  Department,
  DoctorDateException,
  DoctorLeaveEntry,
  DoctorProfile,
  DoctorScheduleData,
  ExceptionSession,
  WeeklySession,
} from '@/features/doctors/domain/entities/doctors.types';

/** Paise per rupee — fees cross the API boundary in paise. */
export const PAISE_PER_RUPEE = 100;

/** DRF time fields arrive as `HH:MM:SS`; the app speaks `HH:MM`. */
const HH_MM_LENGTH = 5;

function hhmm(time: string): string {
  return time.slice(0, HH_MM_LENGTH);
}

export const departmentResponseSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  sort_order: z.number().int(),
  is_active: z.boolean(),
  version: z.number().int(),
});

export const doctorResponseSchema = z.object({
  id: z.string(),
  department_id: z.string(),
  slug: z.string(),
  name: z.string(),
  qualification: z.string().nullable(),
  specialisation: z.string(),
  registration_no: z.string().nullable(),
  experience_years: z.number().int().nullable(),
  bio: z.string().nullable(),
  photo_file_id: z.string().nullable(),
  consultation_fee_paise: z.number().int(),
  slot_length_min: z.number().int(),
  room: z.string().nullable(),
  status: z.enum(['active', 'on_leave', 'inactive']),
  is_bookable_online: z.boolean(),
  rating_avg: z.number().nullable(),
  rating_count: z.number().int(),
  version: z.number().int(),
});

const weeklySessionSchema = z.object({
  weekday: z.number().int(),
  session_code: z.string(),
  label: z.string(),
  starts_at: z.string(),
  ends_at: z.string(),
  is_active: z.boolean().optional(),
});

const leaveSchema = z.object({
  id: z.string(),
  leave_type: z.enum(['casual', 'sick', 'conference', 'other']),
  date_from: z.string(),
  date_to: z.string(),
  reason: z.string().nullable(),
  version: z.number().int(),
});

const exceptionSessionSchema = z.object({
  session_code: z.string(),
  label: z.string(),
  starts_at: z.string(),
  ends_at: z.string(),
});

const dateExceptionSchema = z.object({
  id: z.string(),
  date: z.string(),
  kind: z.enum(['closed', 'custom_sessions']),
  note: z.string().nullable(),
  sessions: z.array(exceptionSessionSchema).optional(),
  version: z.number().int(),
});

export const scheduleResponseSchema = z.object({
  doctor_id: z.string(),
  version: z.number().int(),
  slot_length_min: z.number().int(),
  weekly_sessions: z.array(weeklySessionSchema),
  leaves: z.array(leaveSchema),
  date_exceptions: z.array(dateExceptionSchema),
});

const affectedBookingSchema = z.object({
  appointment_id: z.string(),
  booking_ref: z.string(),
  token_label: z.string(),
  patient_name: z.string(),
  scheduled_start_at: z.string(),
});

/** The schedule-change envelope; `result` is validated by the caller when it needs it. */
export const scheduleChangeResponseSchema = z.object({
  dry_run: z.boolean(),
  result: z.unknown().nullable(),
  affected_bookings: z.array(affectedBookingSchema),
});

export type DepartmentResponse = z.infer<typeof departmentResponseSchema>;
export type DoctorResponse = z.infer<typeof doctorResponseSchema>;
export type ScheduleResponse = z.infer<typeof scheduleResponseSchema>;
export type ScheduleChangeResponse = z.infer<typeof scheduleChangeResponseSchema>;

export function toDepartment(dto: DepartmentResponse): Department {
  return {
    id: dto.id,
    code: dto.code,
    name: dto.name,
    description: dto.description ?? '',
    isActive: dto.is_active,
    sortOrder: dto.sort_order,
    version: dto.version,
  };
}

export function toDoctor(dto: DoctorResponse): DoctorProfile {
  return {
    id: dto.id,
    departmentId: dto.department_id,
    slug: dto.slug,
    name: dto.name,
    qualification: dto.qualification ?? '',
    specialisation: dto.specialisation,
    registrationNo: dto.registration_no ?? '',
    experienceYears: dto.experience_years,
    bio: dto.bio ?? '',
    photoFileId: dto.photo_file_id,
    feeRupees: dto.consultation_fee_paise / PAISE_PER_RUPEE,
    slotLengthMin: dto.slot_length_min,
    room: dto.room ?? '',
    status: dto.status,
    isBookableOnline: dto.is_bookable_online,
    ratingAvg: dto.rating_avg,
    ratingCount: dto.rating_count,
    version: dto.version,
  };
}

function toExceptionSession(dto: z.infer<typeof exceptionSessionSchema>): ExceptionSession {
  return {
    sessionCode: dto.session_code,
    label: dto.label,
    startsAt: hhmm(dto.starts_at),
    endsAt: hhmm(dto.ends_at),
  };
}

function toWeeklySession(dto: z.infer<typeof weeklySessionSchema>): WeeklySession {
  return {
    weekday: dto.weekday,
    sessionCode: dto.session_code,
    label: dto.label,
    startsAt: hhmm(dto.starts_at),
    endsAt: hhmm(dto.ends_at),
  };
}

function toLeave(dto: z.infer<typeof leaveSchema>): DoctorLeaveEntry {
  return {
    id: dto.id,
    kind: dto.leave_type,
    dateFrom: dto.date_from,
    dateTo: dto.date_to,
    reason: dto.reason ?? '',
    version: dto.version,
  };
}

function toDateException(dto: z.infer<typeof dateExceptionSchema>): DoctorDateException {
  return {
    id: dto.id,
    date: dto.date,
    kind: dto.kind,
    note: dto.note ?? '',
    sessions: (dto.sessions ?? []).map(toExceptionSession),
    version: dto.version,
  };
}

export function toSchedule(dto: ScheduleResponse): DoctorScheduleData {
  return {
    doctorId: dto.doctor_id,
    version: dto.version,
    slotLengthMin: dto.slot_length_min,
    // Inactive rows are kept server-side for history; the editor shows live ones.
    weeklySessions: dto.weekly_sessions.filter((s) => s.is_active !== false).map(toWeeklySession),
    leaves: dto.leaves.map(toLeave),
    dateExceptions: dto.date_exceptions.map(toDateException),
  };
}

export function toAffectedBookings(dto: ScheduleChangeResponse): readonly AffectedBooking[] {
  return dto.affected_bookings.map((b) => ({
    appointmentId: b.appointment_id,
    bookingRef: b.booking_ref,
    tokenLabel: b.token_label,
    patientName: b.patient_name,
    scheduledStartAt: b.scheduled_start_at,
  }));
}
