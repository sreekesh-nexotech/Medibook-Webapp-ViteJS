import { z } from 'zod';

import { paginatedSchema } from '@/core/api/pagination';

import type {
  PlatformUserBooking,
  PlatformUserDetail,
  PlatformUserDevice,
  PlatformUserPerson,
  PlatformUserSummary,
} from '@/features/ops-platform-users/domain/entities/platformUsers.entities';
import { PLATFORM_USER_STATUSES } from '@/features/ops-platform-users/domain/entities/platformUsers.entities';

/** `users_admin.summary()` — list rows and the body of every action. */
export const platformUserSummaryResponseSchema = z.object({
  id: z.string(),
  first_name: z.string(),
  last_name: z.string().nullable(),
  phone_e164: z.string().nullable(),
  alternate_phone_e164: z.string().nullable(),
  email: z.string().nullable(),
  status: z.enum(PLATFORM_USER_STATUSES),
  blocked_reason: z.string().nullable(),
  deletion_requested_at: z.string().nullable(),
  last_login_at: z.string().nullable(),
  created_at: z.string(),
});

export const platformUsersPageResponseSchema = paginatedSchema(platformUserSummaryResponseSchema);

const personResponseSchema = z.object({
  id: z.string(),
  first_name: z.string(),
  last_name: z.string().nullable(),
  relation: z.string(),
  is_self: z.boolean(),
  date_of_birth: z.string().nullable(),
  gender: z.string().nullable(),
});

const bookingResponseSchema = z.object({
  id: z.string(),
  booking_ref: z.string(),
  hospital: z.object({ id: z.string(), name: z.string() }),
  doctor: z.object({ id: z.string(), name: z.string() }),
  scheduled_start_at: z.string(),
  status: z.string(),
  source: z.string(),
});

const deviceResponseSchema = z.object({
  id: z.string(),
  platform: z.string(),
  app_version: z.string().nullable(),
  os_version: z.string().nullable(),
  is_active: z.boolean(),
  last_seen_at: z.string().nullable(),
});

/** `users_admin.detail()` — `GET /platform/users/{id}`. */
export const platformUserDetailResponseSchema = platformUserSummaryResponseSchema.extend({
  phone_verified_at: z.string().nullable(),
  email_verified_at: z.string().nullable(),
  has_password: z.boolean(),
  locked_until: z.string().nullable(),
  persons: z.array(personResponseSchema),
  bookings: z.array(bookingResponseSchema),
  devices: z.array(deviceResponseSchema),
  active_sessions: z.number().int(),
});

export type PlatformUserSummaryResponse = z.infer<typeof platformUserSummaryResponseSchema>;
export type PlatformUsersPageResponse = z.infer<typeof platformUsersPageResponseSchema>;
export type PlatformUserDetailResponse = z.infer<typeof platformUserDetailResponseSchema>;

export function toPlatformUserSummary(dto: PlatformUserSummaryResponse): PlatformUserSummary {
  return {
    id: dto.id,
    firstName: dto.first_name,
    lastName: dto.last_name,
    phone: dto.phone_e164,
    alternatePhone: dto.alternate_phone_e164,
    email: dto.email,
    status: dto.status,
    blockedReason: dto.blocked_reason,
    deletionRequestedAt: dto.deletion_requested_at,
    lastLoginAt: dto.last_login_at,
    createdAt: dto.created_at,
  };
}

function toPerson(dto: z.infer<typeof personResponseSchema>): PlatformUserPerson {
  return {
    id: dto.id,
    firstName: dto.first_name,
    lastName: dto.last_name,
    relation: dto.relation,
    isSelf: dto.is_self,
    dateOfBirth: dto.date_of_birth,
    gender: dto.gender,
  };
}

function toBooking(dto: z.infer<typeof bookingResponseSchema>): PlatformUserBooking {
  return {
    id: dto.id,
    bookingRef: dto.booking_ref,
    hospitalName: dto.hospital.name,
    doctorName: dto.doctor.name,
    scheduledStartAt: dto.scheduled_start_at,
    status: dto.status,
    source: dto.source,
  };
}

function toDevice(dto: z.infer<typeof deviceResponseSchema>): PlatformUserDevice {
  return {
    id: dto.id,
    platform: dto.platform,
    appVersion: dto.app_version,
    osVersion: dto.os_version,
    isActive: dto.is_active,
    lastSeenAt: dto.last_seen_at,
  };
}

export function toPlatformUserDetail(dto: PlatformUserDetailResponse): PlatformUserDetail {
  return {
    ...toPlatformUserSummary(dto),
    phoneVerifiedAt: dto.phone_verified_at,
    emailVerifiedAt: dto.email_verified_at,
    hasPassword: dto.has_password,
    lockedUntil: dto.locked_until,
    persons: dto.persons.map(toPerson),
    bookings: dto.bookings.map(toBooking),
    devices: dto.devices.map(toDevice),
    activeSessions: dto.active_sessions,
  };
}
