import type { z } from 'zod';

import { idempotencyKey, ifMatch } from '@/core/api/headers';
import { hospitalApi } from '@/core/api/http';
import { MAX_PAGE_SIZE, paginatedSchema } from '@/core/api/pagination';

import type { StaffRoleCode } from '@/features/users-roles/domain/entities/usersRoles.types';
import type {
  InvitationCreateRequest,
  RolePermissionsPatchRequest,
  StaffRolePatchRequest,
} from '@/features/users-roles/infrastructure/data-sources/remote/usersRoles.request';
import {
  invitationPageResponseSchema,
  invitationResponseSchema,
  rolePageResponseSchema,
  rolePreviewResponseSchema,
  roleResponseSchema,
  staffPageResponseSchema,
  staffResponseSchema,
  type InvitationResponse,
  type RolePreviewResponse,
  type RoleResponse,
  type StaffResponse,
} from '@/features/users-roles/infrastructure/data-sources/remote/usersRoles.response';

/**
 * Hard stop for the page walk below. At `MAX_PAGE_SIZE` rows a page this is
 * 5,000 staff — far past any hospital — so it only ever trips on a backend
 * that keeps answering `has_next: true`.
 */
const MAX_PAGES = 50;

/** Invitations still waiting to be accepted (`InvitationStatusEnum`). */
const PENDING_INVITATION_STATUS = 'invited';

/** Staff actions mounted at `/staff/{id}/<action>` (`rbac/views/hospital_staff_action.py`). */
type StaffAction = 'deactivate' | 'reactivate' | 'reset-password' | 'unlock';

/**
 * Read every page of a list. The Users screen searches, filters and sorts the
 * whole directory on the client — the server's `q` matches email, phone and
 * employee code only, never names — so it needs every row, not one page.
 */
async function getAllPages<T extends z.ZodType>(
  path: string,
  pageSchema: ReturnType<typeof paginatedSchema<T>>,
  params: Readonly<Record<string, string>> = {},
): Promise<z.infer<T>[]> {
  const rows: z.infer<T>[] = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const response = await hospitalApi.get(path, {
      params: { ...params, page, page_size: MAX_PAGE_SIZE },
    });
    const body = pageSchema.parse(response.data);
    rows.push(...body.results);
    if (!body.has_next) break;
  }
  return rows;
}

export function getStaff(): Promise<StaffResponse[]> {
  return getAllPages('/staff', staffPageResponseSchema);
}

export function getPendingInvitations(): Promise<InvitationResponse[]> {
  return getAllPages('/staff/invitations', invitationPageResponseSchema, {
    status: PENDING_INVITATION_STATUS,
  });
}

export async function postInvitation(
  body: InvitationCreateRequest,
  replayKey: string,
): Promise<InvitationResponse> {
  const response = await hospitalApi.post('/staff/invitations', body, {
    headers: idempotencyKey(replayKey),
  });
  return invitationResponseSchema.parse(response.data);
}

export async function postInvitationResend(invitationId: string): Promise<InvitationResponse> {
  const response = await hospitalApi.post(`/staff/invitations/${invitationId}/resend`);
  return invitationResponseSchema.parse(response.data);
}

export async function deleteInvitation(invitationId: string): Promise<InvitationResponse> {
  const response = await hospitalApi.delete(`/staff/invitations/${invitationId}`);
  return invitationResponseSchema.parse(response.data);
}

export async function postStaffAction(
  staffId: string,
  action: StaffAction,
): Promise<StaffResponse> {
  const response = await hospitalApi.post(`/staff/${staffId}/${action}`, {});
  return staffResponseSchema.parse(response.data);
}

export async function patchStaff(
  staffId: string,
  body: StaffRolePatchRequest,
  version: number,
): Promise<StaffResponse> {
  const response = await hospitalApi.patch(`/staff/${staffId}`, body, {
    headers: ifMatch(version),
  });
  return staffResponseSchema.parse(response.data);
}

export function getRoles(): Promise<RoleResponse[]> {
  return getAllPages('/roles', rolePageResponseSchema);
}

export async function patchRolePermissions(
  roleCode: StaffRoleCode,
  body: RolePermissionsPatchRequest,
): Promise<RoleResponse> {
  const response = await hospitalApi.patch(`/roles/${roleCode}/permissions`, body);
  return roleResponseSchema.parse(response.data);
}

export async function getRolePreview(roleCode: StaffRoleCode): Promise<RolePreviewResponse> {
  const response = await hospitalApi.get(`/roles/${roleCode}/preview`);
  return rolePreviewResponseSchema.parse(response.data);
}
