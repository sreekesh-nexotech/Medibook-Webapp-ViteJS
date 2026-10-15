import { attempt } from '@/core/error/attempt';

import type { UsersRolesRepository } from '@/features/users-roles/domain/repositories/usersRoles.repository';
import {
  deleteInvitation,
  getCounters,
  getPermissionCatalogue,
  getPendingInvitations,
  getRolePreview,
  getRoles,
  getStaff,
  patchRole,
  patchRolePermissions,
  patchStaff,
  postInvitation,
  postInvitationResend,
  postStaffAction,
} from '@/features/users-roles/infrastructure/data-sources/remote/usersRoles.api';
import {
  toInvitationCreateRequest,
  toStaffPatchRequest,
} from '@/features/users-roles/infrastructure/data-sources/remote/usersRoles.request';
import {
  toPermissionModules,
  toRolePreview,
  toStaffCounter,
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

  updateStaffDetails: (staffId, details, version) =>
    attempt(async () =>
      toStaffMember(await patchStaff(staffId, toStaffPatchRequest(details), version)),
    ),

  listCounters: () => attempt(async () => (await getCounters()).map(toStaffCounter)),

  listPermissionModules: () =>
    attempt(async () => toPermissionModules(await getPermissionCatalogue())),

  listRoles: () => attempt(async () => (await getRoles()).map(toStaffRole)),

  updateRolePermissions: (roleCode, permissions, version) =>
    attempt(async () =>
      toStaffRole(await patchRolePermissions(roleCode, { permissions }, version)),
    ),

  updateRoleDescription: (roleCode, description, version) =>
    attempt(async () => toStaffRole(await patchRole(roleCode, { description }, version))),

  previewRole: (roleCode) => attempt(async () => toRolePreview(await getRolePreview(roleCode))),
};
