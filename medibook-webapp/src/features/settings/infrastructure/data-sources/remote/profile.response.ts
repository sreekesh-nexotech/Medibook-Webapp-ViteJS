import { z } from 'zod';

import { paginatedSchema } from '@/core/api/pagination';

import type {
  AffectedBooking,
  Holiday,
  HospitalBanner,
  ScheduleChange,
} from '@/features/settings/domain/entities/profile.entities';

/**
 * Response DTOs for module H4, from `schema.yml` (`ScheduleHoliday`,
 * `ScheduleChange`, `AffectedBooking`, `HospitalBanner`). Fields the screen
 * does not use are left unvalidated (Zod strips them).
 */

/* ----------------------------------------------------------------- holidays */

export const holidayResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  date_from: z.string(),
  date_to: z.string(),
  department_id: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
  version: z.number().int(),
});

/** `GET /holidays` answers with the page envelope, not the bare array `schema.yml` shows. */
export const holidayPageResponseSchema = paginatedSchema(holidayResponseSchema);

export type HolidayResponse = z.infer<typeof holidayResponseSchema>;

export function toHoliday(dto: HolidayResponse): Holiday {
  return {
    id: dto.id,
    name: dto.name,
    from: dto.date_from,
    to: dto.date_to,
    departmentId: dto.department_id ?? null,
    note: dto.note ?? null,
    version: dto.version,
  };
}

const affectedBookingSchema = z.object({
  appointment_id: z.string(),
  booking_ref: z.string(),
  patient_name: z.string(),
  scheduled_start_at: z.string(),
});

export const scheduleChangeResponseSchema = z.object({
  dry_run: z.boolean(),
  affected_bookings: z.array(affectedBookingSchema),
});

export type ScheduleChangeResponse = z.infer<typeof scheduleChangeResponseSchema>;

export function toScheduleChange(dto: ScheduleChangeResponse): ScheduleChange {
  return {
    dryRun: dto.dry_run,
    affectedBookings: dto.affected_bookings.map((b): AffectedBooking => ({
      appointmentId: b.appointment_id,
      bookingRef: b.booking_ref,
      patientName: b.patient_name,
      scheduledStartAt: b.scheduled_start_at,
    })),
  };
}

/* ------------------------------------------------------------------ banners */

const DEFAULT_AUDIENCE = 'hospital_patients';

export const bannerResponseSchema = z.object({
  id: z.string(),
  title: z.string(),
  body: z.string().nullable().optional(),
  image_file_id: z.string().nullable().optional(),
  audience: z.enum(['hospital_patients', 'all_patients_in_city']).optional(),
  starts_at: z.string().nullable().optional(),
  ends_at: z.string().nullable().optional(),
  sort_order: z.number().int().optional(),
  is_enabled: z.boolean().optional(),
  published: z.boolean(),
  version: z.number().int(),
});

/** `GET /banners` answers with the page envelope, not the bare array `schema.yml` shows. */
export const bannerPageResponseSchema = paginatedSchema(bannerResponseSchema);

export type BannerResponse = z.infer<typeof bannerResponseSchema>;

export function toHospitalBanner(dto: BannerResponse): HospitalBanner {
  return {
    id: dto.id,
    title: dto.title,
    body: dto.body ?? null,
    imageFileId: dto.image_file_id ?? null,
    audience: dto.audience ?? DEFAULT_AUDIENCE,
    startsAt: dto.starts_at ?? null,
    endsAt: dto.ends_at ?? null,
    sortOrder: dto.sort_order ?? 0,
    isEnabled: dto.is_enabled ?? true,
    published: dto.published,
    version: dto.version,
  };
}
