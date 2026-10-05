import { attempt } from '@/core/error/attempt';

import type { UsersRolesRepository } from '@/features/users-roles/domain/repositories/usersRoles.repository';
import {
  deleteInvitation,
  getPendingInvitations,
  getRolePreview,
  getRoles,
  getStaff,
  patchRolePermissions,
  patchStaff,
  postInvitation,
  postInvitationResend,
  postStaffAction,
} from '@/features/users-roles/infrastructure/data-sources/remote/usersRoles.api';
import { toInvitationCreateRequest } from '@/features/users-roles/infrastructure/data-sources/remote/usersRoles.request';
import {
  toRolePreview,
  toStaffInvitation,
  toStaffMember,
  toStaffRole,
} from '@/features/users-roles/infrastructure/data-sources/remote/usersRoles.response';

export const usersRolesRepository: UsersRolesRepository = {
  listStaff: () => attempt(async () => (await getStaff()).map(toStaffMember)),

  listPendingInvitations: () =>
    attempt(async () => (await getPendingInvitations()).map(toStaffInvitation)),

  inviteStaff: (draft, idempotencyKey) =>
    attempt(async () =>
      toStaffInvitation(await postInvitation(toInvitationCreateRequest(draft), idempotencyKey)),
    ),

  resendInvitation: (invitationId) =>
    attempt(async () => toStaffInvitation(await postInvitationResend(invitationId))),

  revokeInvitation: (invitationId) =>
    attempt(async () => toStaffInvitation(await deleteInvitation(invitationId))),

  deactivateStaff: (staffId) =>
    attempt(async () => toStaffMember(await postStaffAction(staffId, 'deactivate'))),

  reactivateStaff: (staffId) =>
    attempt(async () => toStaffMember(await postStaffAction(staffId, 'reactivate'))),

  sendPasswordReset: (staffId) =>
    attempt(async () => toStaffMember(await postStaffAction(staffId, 'reset-password'))),

  unlockStaff: (staffId) =>
    attempt(async () => toStaffMember(await postStaffAction(staffId, 'unlock'))),

  changeStaffRole: (staffId, roleCode, version) =>
    attempt(async () => toStaffMember(await patchStaff(staffId, { role_code: roleCode }, version))),

  listRoles: () => attempt(async () => (await getRoles()).map(toStaffRole)),

  updateRolePermissions: (roleCode, permissions) =>
    attempt(async () => toStaffRole(await patchRolePermissions(roleCode, { permissions }))),

  previewRole: (roleCode) => attempt(async () => toRolePreview(await getRolePreview(roleCode))),
};
