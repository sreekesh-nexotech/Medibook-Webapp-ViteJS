import { toPage } from '@/core/api/pagination';
import { attempt } from '@/core/error/attempt';

import type { PlatformUsersRepository } from '@/features/ops-platform-users/domain/repositories/platformUsers.repository';
import {
  getPlatformUser,
  getPlatformUsers,
  postPlatformUserAction,
} from '@/features/ops-platform-users/infrastructure/data-sources/remote/platformUsers.api';
import {
  toCountQuery,
  toListQuery,
} from '@/features/ops-platform-users/infrastructure/data-sources/remote/platformUsers.request';
import {
  toPlatformUserDetail,
  toPlatformUserSummary,
} from '@/features/ops-platform-users/infrastructure/data-sources/remote/platformUsers.response';

/**
 * `UserBlockRequest.reason` is required by the schema on unblock and unlock
 * too, but the server ignores it there; this is what those calls send.
 */
const NON_BLOCK_ACTION_REASON = 'Ops console action';

export const platformUsersRepository: PlatformUsersRepository = {
  listUsers: (params) =>
    attempt(async () => toPage(await getPlatformUsers(toListQuery(params)), toPlatformUserSummary)),

  countUsers: (filter) => attempt(async () => (await getPlatformUsers(toCountQuery(filter))).total),

  getUser: (id) => attempt(async () => toPlatformUserDetail(await getPlatformUser(id))),

  blockUser: (id, reason) =>
    attempt(async () =>
      toPlatformUserSummary(await postPlatformUserAction(id, 'block', { reason })),
    ),

  unblockUser: (id) =>
    attempt(async () =>
      toPlatformUserSummary(
        await postPlatformUserAction(id, 'unblock', { reason: NON_BLOCK_ACTION_REASON }),
      ),
    ),

  unlockUser: (id) =>
    attempt(async () =>
      toPlatformUserSummary(
        await postPlatformUserAction(id, 'unlock', { reason: NON_BLOCK_ACTION_REASON }),
      ),
    ),
};
