import { z } from 'zod';

import { paginatedSchema } from '@/core/api/pagination';

import type {
  OpsPermission,
  OpsStaffMember,
  OpsStaffRole,
} from '@/features/ops-users/domain/entities/opsUsers.types';

/**
 * Response DTOs for `/platform/staff`, `/roles` and `/permissions`.
 * `schema.yml` types the embedded `user` / `role` objects and the catalogue
 * as bare objects; these follow the backend serializers
 * (`platform/serializers/staff_out.py`, `staff_role_out.py`,
 * `views/staff_permissions.py`). Lists are paginated (`core/pagination.py`).
 */

const staffSchema = z.object({
  id: z.string(),
  user: z.object({
    id: z.string(),
    first_name: z.string(),
    last_name: z.string().nullable(),
    email: z.string().nullable(),
    last_login_at: z.string().nullable(),
  }),
  role: z.object({ id: z.string(), code: z.string(), name: z.string() }),
  status: z.enum(['invited', 'active', 'deactivated']),
  locked_until: z.string().nullable(),
  version: z.number().int(),
});

const roleSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  is_system: z.boolean(),
  permissions: z.array(z.string()),
  version: z.number().int(),
});

export const staffResponseSchema = staffSchema;
export const staffPageResponseSchema = paginatedSchema(staffSchema);
export const rolePageResponseSchema = paginatedSchema(roleSchema);

export const permissionsResponseSchema = z.object({
  permissions: z.array(
    z.object({
      code: z.string(),
      module: z.string(),
      action: z.string(),
      /** `<Module label>.<action>`, e.g. `Platform Users.view`. */
      label: z.string(),
    }),
  ),
});

export type StaffResponse = z.infer<typeof staffSchema>;
export type StaffPageResponse = z.infer<typeof staffPageResponseSchema>;
export type RoleResponse = z.infer<typeof roleSchema>;
export type RolePageResponse = z.infer<typeof rolePageResponseSchema>;
export type PermissionsResponse = z.infer<typeof permissionsResponseSchema>;

export function toStaffMember(dto: StaffResponse): OpsStaffMember {
  const { user } = dto;
  return {
    id: dto.id,
    userId: user.id,
    name: [user.first_name, user.last_name].filter(Boolean).join(' '),
    email: user.email ?? '',
    lastLoginAt: user.last_login_at,
    role: dto.role,
    status: dto.status,
    lockedUntil: dto.locked_until,
    version: dto.version,
  };
}

export function toStaffRole(dto: RoleResponse): OpsStaffRole {
  return {
    id: dto.id,
    code: dto.code,
    name: dto.name,
    isSystem: dto.is_system,
    permissions: dto.permissions,
    version: dto.version,
  };
}

export function toPermissions(dto: PermissionsResponse): readonly OpsPermission[] {
  return dto.permissions.map((p) => {
    const dot = p.label.lastIndexOf('.');
    return {
      code: p.code,
      module: p.module,
      action: p.action,
      moduleLabel: dot > 0 ? p.label.slice(0, dot) : p.module,
    };
  });
}
