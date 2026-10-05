import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { platformUsersKeys } from '@/features/ops-platform-users/application/queries/platformUsers.keys';
import { countPlatformUsers } from '@/features/ops-platform-users/application/usecases/countPlatformUsers';
import type { PlatformUserStatus } from '@/features/ops-platform-users/domain/entities/platformUsers.entities';

const PLATFORM_USER_COUNT_STALE_MS = 60_000;

/** Number of accounts with `status` (every account when `null`) — for the KPI tiles. */
export function usePlatformUserCountQuery(status: PlatformUserStatus | null) {
  return useQuery({
    queryKey: platformUsersKeys.count(status),
    queryFn: async () => unwrap(await countPlatformUsers(status)),
    staleTime: PLATFORM_USER_COUNT_STALE_MS,
  });
}
