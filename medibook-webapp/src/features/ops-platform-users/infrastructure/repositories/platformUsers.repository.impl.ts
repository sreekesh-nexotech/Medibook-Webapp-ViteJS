import { toPage } from '@/core/api/pagination';
import { attempt } from '@/core/error/attempt';

import type { PlatformUsersRepository } from '@/features/ops-platform-users/domain/repositories/platformUsers.repository';
import {
  getPlatformUser,
  getPlatformUsers,
  postPlatformUserAction,
} from '@/features/ops-platform-users/infrastructure/data-sources/remote/platformUsers.api';
import { toListQuery } from '@/features/ops-platform-users/infrastructure/data-sources/remote/platformUsers.request';
import {
  toPlatformUserDetail,
  toPlatformUserSummary,
} from '@/features/ops-platform-users/infrastructure/data-sources/remote/platformUsers.response';

/** A count needs only the page's `total`, so ask for the smallest page. */
const COUNT_PAGE_SIZE = 1;

/**
 * `UserBlockRequest.reason` is required by the schema on unblock and unlock
 * too, but the server ignores it there; this is what those calls send.
 */
const NON_BLOCK_ACTION_REASON = 'Ops console action';

export const platformUsersRepository: PlatformUsersRepository = {
  listUsers: (params) =>
    attempt(async () => toPage(await getPlatformUsers(toListQuery(params)), toPlatformUserSummary)),

  countUsers: (status) =>
    attempt(async () => {
      const page = await getPlatformUsers({
        page: 1,
        page_size: COUNT_PAGE_SIZE,
        ...(status ? { status } : {}),
      });
      return page.total;
    }),

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
