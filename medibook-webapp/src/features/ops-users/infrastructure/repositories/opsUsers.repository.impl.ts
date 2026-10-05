import { toPage } from '@/core/api/pagination';
import { attempt } from '@/core/error/attempt';

import type { OpsUsersRepository } from '@/features/ops-users/domain/repositories/opsUsers.repository';
import {
  getPermissions,
  getRoles,
  getStaff,
  patchStaffRole,
  postStaff,
  postStaffAction,
} from '@/features/ops-users/infrastructure/data-sources/remote/opsUsers.api';
import {
  toPermissions,
  toStaffMember,
  toStaffRole,
} from '@/features/ops-users/infrastructure/data-sources/remote/opsUsers.response';

export const opsUsersRepository: OpsUsersRepository = {
  listStaff: () => attempt(async () => toPage(await getStaff(), toStaffMember)),

  inviteStaff: (invite) => attempt(async () => toStaffMember(await postStaff(invite))),

  changeStaffRole: (id, roleId, version) =>
    attempt(async () => toStaffMember(await patchStaffRole(id, roleId, version))),

  deactivateStaff: (id) =>
    attempt(async () => toStaffMember(await postStaffAction(id, 'deactivate'))),

  reactivateStaff: (id) =>
    attempt(async () => toStaffMember(await postStaffAction(id, 'reactivate'))),

  unlockStaff: (id) => attempt(async () => toStaffMember(await postStaffAction(id, 'unlock'))),

  listRoles: () => attempt(async () => (await getRoles()).results.map(toStaffRole)),

  listPermissions: () => attempt(async () => toPermissions(await getPermissions())),
};
