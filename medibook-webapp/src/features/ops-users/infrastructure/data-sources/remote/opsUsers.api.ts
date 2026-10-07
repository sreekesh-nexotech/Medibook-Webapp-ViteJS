import { ifMatch } from '@/core/api/headers';
import { platformApi } from '@/core/api/http';
import { MAX_PAGE_SIZE } from '@/core/api/pagination';

import type {
  OpsRoleChanges,
  OpsRoleDraft,
  OpsStaffInvite,
} from '@/features/ops-users/domain/entities/opsUsers.types';
import type {
  AssignableStaffPageResponse,
  PermissionsResponse,
  RolePageResponse,
  RoleResponse,
  StaffPageResponse,
  StaffResponse,
} from '@/features/ops-users/infrastructure/data-sources/remote/opsUsers.response';
import {
  assignableStaffPageResponseSchema,
  permissionsResponseSchema,
  rolePageResponseSchema,
  roleResponseSchema,
  staffPageResponseSchema,
  staffResponseSchema,
} from '@/features/ops-users/infrastructure/data-sources/remote/opsUsers.response';

/** Platform staff administration endpoints (`/api/v1/platform/…`). */

/**
 * Staff actions the backend exposes as `POST /staff/{id}/<action>`.
 * `resend-invite` is B2's (BE-31): a fresh set-password email for an invited member.
 */
export type StaffAction = 'deactivate' | 'reactivate' | 'unlock' | 'resend-invite';

export async function getStaff(): Promise<StaffPageResponse> {
  const response = await platformApi.get('/staff', { params: { page_size: MAX_PAGE_SIZE } });
  return staffPageResponseSchema.parse(response.data);
}

/** `GET /staff/assignable` — the assignee picker, readable by roles without `staff.view`. */
export async function getAssignableStaff(): Promise<AssignableStaffPageResponse> {
  const response = await platformApi.get('/staff/assignable', {
    params: { page_size: MAX_PAGE_SIZE },
  });
  return assignableStaffPageResponseSchema.parse(response.data);
}

export async function postStaff(invite: OpsStaffInvite): Promise<StaffResponse> {
  const response = await platformApi.post('/staff', {
    email: invite.email,
    first_name: invite.firstName,
    last_name: invite.lastName,
    role_id: invite.roleId,
  });
  return staffResponseSchema.parse(response.data);
}

export async function patchStaffRole(
  id: string,
  roleId: string,
  version: number,
): Promise<StaffResponse> {
  const response = await platformApi.patch(
    `/staff/${encodeURIComponent(id)}`,
    { role_id: roleId },
    { headers: ifMatch(version) },
  );
  return staffResponseSchema.parse(response.data);
}

export async function postStaffAction(id: string, action: StaffAction): Promise<StaffResponse> {
  const response = await platformApi.post(
    `/staff/${encodeURIComponent(id)}/${encodeURIComponent(action)}`,
  );
  return staffResponseSchema.parse(response.data);
}

export async function getRoles(): Promise<RolePageResponse> {
  const response = await platformApi.get('/roles', { params: { page_size: MAX_PAGE_SIZE } });
  return rolePageResponseSchema.parse(response.data);
}

export async function getPermissions(): Promise<PermissionsResponse> {
  const response = await platformApi.get('/permissions');
  return permissionsResponseSchema.parse(response.data);
}

/** `POST /platform/roles {code, name, permissions}` (`staff.add`). */
export async function postRole(draft: OpsRoleDraft): Promise<RoleResponse> {
  const response = await platformApi.post('/roles', {
    code: draft.code,
    name: draft.name,
    permissions: draft.permissions,
  });
  return roleResponseSchema.parse(response.data);
}

/** `PATCH /platform/roles/{id} {name?, permissions?}` + `If-Match` (`staff.edit`). */
export async function patchRole(
  id: string,
  changes: OpsRoleChanges,
  version: number,
): Promise<RoleResponse> {
  const response = await platformApi.patch(
    `/roles/${encodeURIComponent(id)}`,
    {
      ...(changes.name !== undefined ? { name: changes.name } : {}),
      ...(changes.permissions !== undefined ? { permissions: changes.permissions } : {}),
    },
    { headers: ifMatch(version) },
  );
  return roleResponseSchema.parse(response.data);
}

/** `DELETE /platform/roles/{id}` + `If-Match` (`staff.del`; system roles and roles in use refused). */
export async function deleteRole(id: string, version: number): Promise<void> {
  await platformApi.delete(`/roles/${encodeURIComponent(id)}`, { headers: ifMatch(version) });
}
