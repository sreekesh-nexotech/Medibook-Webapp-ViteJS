import { z } from 'zod';

import type {
  AffectedBooking,
  Department,
  DoctorDateException,
  DoctorLeaveEntry,
  DoctorProfile,
  DoctorReview,
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

/** `HH:MM` or `HH:MM:SS`. */
const CLOCK_PATTERN = /^\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/;
/** An ISO date-time with its offset: the clock part is local to that offset. */
const ISO_DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}[T ](\d{2}:\d{2})/;

/**
 * The wall-clock `HH:MM` of a schedule time, whether the backend sends a
 * plain time (`09:00:00`) or a full date-time (`2026-10-07T09:00:00+05:30`,
 * what the resolved schedule sends). A date-time is written in the
 * hospital's own offset (`timeutil.combine_local`), so its clock part already
 * is hospital-local — reading it as written avoids converting through the
 * browser's zone (UAT-19, D-09). `null` when neither shape matches.
 */
export function toWallClockHhmm(value: string | null | undefined): string | null {
  const raw = (value ?? '').trim();
  if (CLOCK_PATTERN.test(raw)) return raw.slice(0, HH_MM_LENGTH);
  const match = ISO_DATE_TIME_PATTERN.exec(raw);
  return match?.[1] ?? null;
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
  title: z.string().nullable().optional(),
  qualification: z.string().nullable(),
  specialisation: z.string(),
  registration_no: z.string().nullable(),
  experience_years: z.number().int().nullable(),
  bio: z.string().nullable(),
  photo_file_id: z.string().nullable(),
  consultation_fee_paise: z.number().int(),
  // Optional so an older backend without it still parses.
  follow_up_fee_paise: z.number().int().nullable().optional(),
  expected_consult_minutes: z.number().int().nullable().optional(),
  slot_length_min: z.number().int(),
  room: z.string().nullable(),
  status: z.enum(['active', 'on_leave', 'inactive']),
  is_bookable_online: z.boolean(),
  rating_avg: z.number().nullable(),
  rating_count: z.number().int(),
  // DRF decimal → string ("4.20"); optional so an older backend still parses.
  rating_base: z.union([z.string(), z.number()]).nullable().optional(),
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

export const leaveSchema = z.object({
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

/**
 * A session of the resolved next-14-days view. `starts_at`/`ends_at` are full
 * ISO date-times; `start_time`/`end_time` are the hospital-local `HH:MM` the
 * backend adds (BE-33) — optional so the current backend still parses.
 */
const resolvedSessionSchema = exceptionSessionSchema.extend({
  start_time: z.string().nullable().optional(),
  end_time: z.string().nullable().optional(),
});

export const dateExceptionSchema = z.object({
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
  resolved: z
    .array(
      z.object({
        date: z.string(),
        source: z.string(),
        sessions: z.array(resolvedSessionSchema),
      }),
    )
    .optional(),
});

const affectedBookingSchema = z.object({
  appointment_id: z.string(),
  booking_ref: z.string(),
  // `AffectedBookingSerializer.token_label` is `allow_null` (06·Departments F5).
  token_label: z.string().nullable(),
  patient_name: z.string(),
  scheduled_start_at: z.string(),
});

/** The schedule-change envelope; `result` is validated by the caller when it needs it. */
export const scheduleChangeResponseSchema = z.object({
  dry_run: z.boolean(),
  result: z.unknown().nullable(),
  affected_bookings: z.array(affectedBookingSchema),
  // Confirm-bound-to-preview (BE-33): optional until the backend issues it.
  preview_token: z.string().nullable().optional(),
  rematerialisation_queued: z.boolean().optional(),
});

/** `GET /doctors/{id}/reviews` row (DOC-01). Lenient: only `rating` is required to show it. */
export const doctorReviewResponseSchema = z.object({
  id: z.string(),
  rating: z.number(),
  comment: z.string().nullable().optional(),
  created_at: z.string().nullable().optional(),
  patient_display_name: z.string().nullable().optional(),
  booking_ref: z.string().nullable().optional(),
});

export type DepartmentResponse = z.infer<typeof departmentResponseSchema>;
export type DoctorResponse = z.infer<typeof doctorResponseSchema>;
export type ScheduleResponse = z.infer<typeof scheduleResponseSchema>;
export type ScheduleChangeResponse = z.infer<typeof scheduleChangeResponseSchema>;
export type DoctorReviewResponse = z.infer<typeof doctorReviewResponseSchema>;

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
    title: dto.title ?? '',
    qualification: dto.qualification ?? '',
    specialisation: dto.specialisation,
    registrationNo: dto.registration_no ?? '',
    experienceYears: dto.experience_years,
    bio: dto.bio ?? '',
    photoFileId: dto.photo_file_id,
    feePaise: dto.consultation_fee_paise,
    followUpFeePaise: dto.follow_up_fee_paise ?? null,
    feeRupees: dto.consultation_fee_paise / PAISE_PER_RUPEE,
    expectedConsultMinutes: dto.expected_consult_minutes ?? null,
    followUpFeeRupees:
      dto.follow_up_fee_paise == null ? null : dto.follow_up_fee_paise / PAISE_PER_RUPEE,
    slotLengthMin: dto.slot_length_min,
    room: dto.room ?? '',
    status: dto.status,
    isBookableOnline: dto.is_bookable_online,
    ratingAvg: dto.rating_avg,
    ratingCount: dto.rating_count,
    ratingBase: dto.rating_base == null ? null : Number(dto.rating_base),
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

export function toLeave(dto: z.infer<typeof leaveSchema>): DoctorLeaveEntry {
  return {
    id: dto.id,
    kind: dto.leave_type,
    dateFrom: dto.date_from,
    dateTo: dto.date_to,
    reason: dto.reason ?? '',
    version: dto.version,
  };
}

export function toDateException(dto: z.infer<typeof dateExceptionSchema>): DoctorDateException {
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
    upcoming: (dto.resolved ?? []).map((day) => ({
      date: day.date,
      source: day.source,
      sessions: day.sessions.map(toResolvedSession),
    })),
  };
}

/** A resolved session: the backend's `HH:MM` when sent, else the date-time's clock part. */
function toResolvedSession(dto: z.infer<typeof resolvedSessionSchema>): ExceptionSession {
  return {
    sessionCode: dto.session_code,
    label: dto.label,
    startsAt: toWallClockHhmm(dto.start_time) ?? toWallClockHhmm(dto.starts_at) ?? '',
    endsAt: toWallClockHhmm(dto.end_time) ?? toWallClockHhmm(dto.ends_at) ?? '',
  };
}

export function toDoctorReview(dto: DoctorReviewResponse): DoctorReview {
  return {
    id: dto.id,
    rating: dto.rating,
    comment: dto.comment ?? '',
    createdAt: dto.created_at ?? null,
    author: dto.patient_display_name ?? null,
    bookingRef: dto.booking_ref ?? null,
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
