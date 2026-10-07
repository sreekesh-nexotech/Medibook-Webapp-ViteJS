import { z } from 'zod';

import { paginatedSchema } from '@/core/api/pagination';

import type {
  PermissionModule,
  RolePreview,
  StaffCounter,
  StaffInvitation,
  StaffMember,
  StaffRole,
} from '@/features/users-roles/domain/entities/usersRoles.types';

/**
 * Response DTOs for `/api/v1/hospital/staff`, `/staff/invitations` and `/roles`.
 *
 * `schema.yml` declares the three list endpoints as plain arrays, but every
 * backend list goes through `core/pagination.py`, so the real body is the
 * `{results, page, page_size, total, has_next}` envelope — validated here.
 * `Staff.user` / `Staff.role` are untyped objects in the schema; their fields
 * come from `rbac/serializers/staff_out.py`.
 */

const roleCodeSchema = z.enum(['admin', 'receptionist', 'accountant', 'dept_front_desk']);

export const staffResponseSchema = z.object({
  id: z.string(),
  user: z.object({
    id: z.string(),
    first_name: z.string(),
    last_name: z.string().nullable(),
    email: z.string().nullable(),
    phone_e164: z.string().nullable(),
    last_login_at: z.string().nullable(),
  }),
  role: z.object({ code: roleCodeSchema, name: z.string() }),
  employee_code: z.string().nullable(),
  designation: z.string().nullable(),
  counter_id: z.string().nullable(),
  status: z.enum(['invited', 'active', 'deactivated']),
  joined_at: z.string().nullable(),
  deactivated_at: z.string().nullable(),
  locked_until: z.string().nullable(),
  version: z.number().int(),
});

export const staffPageResponseSchema = paginatedSchema(staffResponseSchema);

export type StaffResponse = z.infer<typeof staffResponseSchema>;

export const invitationResponseSchema = z.object({
  id: z.string(),
  email: z.string(),
  first_name: z.string(),
  last_name: z.string().nullable(),
  phone_e164: z.string().nullable(),
  role_code: z.string(),
  status: z.enum(['invited', 'accepted', 'expired', 'revoked']),
  invited_at: z.string(),
  last_sent_at: z.string(),
  resend_count: z.number().int(),
  expires_at: z.string(),
  accepted_at: z.string().nullable(),
  is_first_admin: z.boolean(),
});

export const invitationPageResponseSchema = paginatedSchema(invitationResponseSchema);

export type InvitationResponse = z.infer<typeof invitationResponseSchema>;

export const roleResponseSchema = z.object({
  id: z.string(),
  code: roleCodeSchema,
  name: z.string(),
  description: z.string().nullable().optional(),
  version: z.number().int().optional(),
  is_system: z.boolean(),
  editable: z.boolean(),
  permissions: z.array(z.string()),
});

export const rolePageResponseSchema = paginatedSchema(roleResponseSchema);

export type RoleResponse = z.infer<typeof roleResponseSchema>;

/** `GET /roles/{code}/preview` (`rbac/views/hospital_role_preview.py`); untyped in the schema. */
export const rolePreviewResponseSchema = z.object({
  role: z.object({ code: z.string(), name: z.string() }),
  modules: z.array(
    z.object({ module: z.string(), label: z.string(), actions: z.array(z.string()) }),
  ),
});

export type RolePreviewResponse = z.infer<typeof rolePreviewResponseSchema>;

/** `GET /permissions` — the hospital permission catalogue, grouped by module. */
export const permissionCatalogueResponseSchema = z.object({
  modules: z.array(
    z.object({ module: z.string(), label: z.string(), actions: z.array(z.string()) }),
  ),
});

export type PermissionCatalogueResponse = z.infer<typeof permissionCatalogueResponseSchema>;

export const counterResponseSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  is_active: z.boolean(),
});

export const counterPageResponseSchema = paginatedSchema(counterResponseSchema);

export type CounterResponse = z.infer<typeof counterResponseSchema>;

export function toPermissionModules(dto: PermissionCatalogueResponse): PermissionModule[] {
  return dto.modules.map((m) => ({ module: m.module, label: m.label, actions: m.actions }));
}

export function toStaffCounter(dto: CounterResponse): StaffCounter {
  return { id: dto.id, code: dto.code, name: dto.name, isActive: dto.is_active };
}

export function toStaffMember(dto: StaffResponse): StaffMember {
  return {
    id: dto.id,
    userId: dto.user.id,
    firstName: dto.user.first_name,
    lastName: dto.user.last_name,
    email: dto.user.email,
    phone: dto.user.phone_e164,
    roleCode: dto.role.code,
    roleName: dto.role.name,
    employeeCode: dto.employee_code,
    designation: dto.designation,
    counterId: dto.counter_id,
    status: dto.status,
    joinedAt: dto.joined_at,
    deactivatedAt: dto.deactivated_at,
    lastLoginAt: dto.user.last_login_at,
    lockedUntil: dto.locked_until,
    version: dto.version,
  };
}

export function toStaffInvitation(dto: InvitationResponse): StaffInvitation {
  return {
    id: dto.id,
    email: dto.email,
    firstName: dto.first_name,
    lastName: dto.last_name,
    phone: dto.phone_e164,
    roleCode: dto.role_code,
    status: dto.status,
    invitedAt: dto.invited_at,
    lastSentAt: dto.last_sent_at,
    resendCount: dto.resend_count,
    expiresAt: dto.expires_at,
  };
}

export function toStaffRole(dto: RoleResponse): StaffRole {
  return {
    id: dto.id,
    code: dto.code,
    name: dto.name,
    description: dto.description ?? null,
    version: dto.version ?? null,
    isSystem: dto.is_system,
    editable: dto.editable,
    permissions: dto.permissions,
  };
}

export function toRolePreview(dto: RolePreviewResponse): RolePreview {
  return {
    roleCode: dto.role.code,
    roleName: dto.role.name,
    modules: dto.modules,
  };
}
