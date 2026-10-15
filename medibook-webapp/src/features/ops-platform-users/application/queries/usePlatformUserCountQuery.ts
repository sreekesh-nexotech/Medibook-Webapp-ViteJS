import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { platformUsersKeys } from '@/features/ops-platform-users/application/queries/platformUsers.keys';
import { countPlatformUsers } from '@/features/ops-platform-users/application/usecases/countPlatformUsers';
import type { PlatformUserCountFilter } from '@/features/ops-platform-users/domain/entities/platformUsers.entities';

const PLATFORM_USER_COUNT_STALE_MS = 60_000;

/** Number of accounts matching `filter` — for the KPI tiles. */
export function usePlatformUserCountQuery(filter: PlatformUserCountFilter) {
  return useQuery({
    queryKey: platformUsersKeys.count(filter),
    queryFn: async () => unwrap(await countPlatformUsers(filter)),
    staleTime: PLATFORM_USER_COUNT_STALE_MS,
  });
}
