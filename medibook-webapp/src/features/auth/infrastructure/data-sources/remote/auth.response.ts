import { z } from 'zod';

import type {
  HospitalSession,
  InvitationPreview,
  PlatformSession,
  StaffUser,
} from '@/features/auth/domain/entities/auth.types';

/**
 * Response DTOs for the staff auth endpoints. `schema.yml` types `/me` and the
 * invitation preview as bare objects; these follow the backend views
 * (`accounts/views/hospital_me.py`, `platform_me.py`,
 * `rbac/services/invitations.preview`).
 */

/** `UserSerializer` — the signed-in user's own account. */
const userSchema = z.object({
  id: z.string(),
  first_name: z.string(),
  last_name: z.string().nullable(),
  email: z.string().nullable(),
  locale: z.string(),
  timezone: z.string(),
  version: z.number().int(),
});

const roleSchema = z.object({ code: z.string(), name: z.string() });

export const hospitalMeResponseSchema = z.object({
  user: userSchema,
  staff: z.object({ id: z.string() }),
  role: roleSchema,
  permissions: z.array(z.string()),
  hospital: z.object({
    id: z.string(),
    name: z.string(),
    status: z.enum(['draft', 'onboarding', 'active', 'suspended', 'closed']),
    timezone: z.string(),
    read_only: z.boolean(),
    // Optional so an older backend without it still signs in.
    logo_file_id: z.string().nullable().optional(),
  }),
  default_counter: z.object({ id: z.string(), code: z.string(), name: z.string() }).nullable(),
});

export const platformMeResponseSchema = z.object({
  user: userSchema,
  role: roleSchema,
  permissions: z.array(z.string()),
});

export const invitationPreviewResponseSchema = z.object({
  email: z.string(),
  first_name: z.string().nullable(),
  last_name: z.string().nullable(),
  hospital: z.object({ id: z.string(), name: z.string() }),
  role: roleSchema,
  expires_at: z.string(),
  account_exists: z.boolean(),
});

type UserResponse = z.infer<typeof userSchema>;
export type HospitalMeResponse = z.infer<typeof hospitalMeResponseSchema>;
export type PlatformMeResponse = z.infer<typeof platformMeResponseSchema>;
export type InvitationPreviewResponse = z.infer<typeof invitationPreviewResponseSchema>;

function toStaffUser(dto: UserResponse): StaffUser {
  return {
    id: dto.id,
    firstName: dto.first_name,
    lastName: dto.last_name,
    email: dto.email ?? '',
    locale: dto.locale,
    timezone: dto.timezone,
    version: dto.version,
  };
}

export function toHospitalSession(dto: HospitalMeResponse): HospitalSession {
  return {
    surface: 'hospital',
    user: toStaffUser(dto.user),
    staffId: dto.staff.id,
    defaultCounter: dto.default_counter,
    role: dto.role,
    permissions: dto.permissions,
    hospital: {
      id: dto.hospital.id,
      name: dto.hospital.name,
      status: dto.hospital.status,
      timezone: dto.hospital.timezone,
      readOnly: dto.hospital.read_only,
      logoFileId: dto.hospital.logo_file_id ?? null,
    },
  };
}

export function toPlatformSession(dto: PlatformMeResponse): PlatformSession {
  return {
    surface: 'platform',
    user: toStaffUser(dto.user),
    role: dto.role,
    permissions: dto.permissions,
  };
}

export function toInvitationPreview(dto: InvitationPreviewResponse): InvitationPreview {
  return {
    email: dto.email,
    firstName: dto.first_name ?? '',
    lastName: dto.last_name,
    hospitalName: dto.hospital.name,
    roleName: dto.role.name,
    expiresAt: dto.expires_at,
    accountExists: dto.account_exists,
  };
}
