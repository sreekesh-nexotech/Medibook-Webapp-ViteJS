import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { platformUsersKeys } from '@/features/ops-platform-users/application/queries/platformUsers.keys';
import { fetchPlatformUsers } from '@/features/ops-platform-users/application/usecases/fetchPlatformUsers';
import type { PlatformUserListParams } from '@/features/ops-platform-users/domain/entities/platformUsers.entities';

/** Accounts move slowly; a list a few seconds old is fine. */
const PLATFORM_USERS_STALE_MS = 30_000;

/** One page of patient accounts. Keeps the previous page on screen while the next loads. */
export function usePlatformUsersQuery(params: PlatformUserListParams) {
  return useQuery({
    queryKey: platformUsersKeys.list(params),
    queryFn: async () => unwrap(await fetchPlatformUsers(params)),
    staleTime: PLATFORM_USERS_STALE_MS,
    placeholderData: keepPreviousData,
  });
}
