import { ifMatch } from '@/core/api/headers';
import { platformApi } from '@/core/api/http';
import { MAX_PAGE_SIZE } from '@/core/api/pagination';

import type { OpsStaffInvite } from '@/features/ops-users/domain/entities/opsUsers.types';
import type {
  PermissionsResponse,
  RolePageResponse,
  StaffPageResponse,
  StaffResponse,
} from '@/features/ops-users/infrastructure/data-sources/remote/opsUsers.response';
import {
  permissionsResponseSchema,
  rolePageResponseSchema,
  staffPageResponseSchema,
  staffResponseSchema,
} from '@/features/ops-users/infrastructure/data-sources/remote/opsUsers.response';

/** Platform staff administration endpoints (`/api/v1/platform/…`). */

/** Staff actions the backend exposes as `POST /staff/{id}/<action>`. */
export type StaffAction = 'deactivate' | 'reactivate' | 'unlock';

export async function getStaff(): Promise<StaffPageResponse> {
  const response = await platformApi.get('/staff', { params: { page_size: MAX_PAGE_SIZE } });
  return staffPageResponseSchema.parse(response.data);
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
