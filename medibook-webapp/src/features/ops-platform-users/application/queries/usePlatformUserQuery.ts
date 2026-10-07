import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { platformUsersKeys } from '@/features/ops-platform-users/application/queries/platformUsers.keys';
import { fetchPlatformUser } from '@/features/ops-platform-users/application/usecases/fetchPlatformUser';

/** One patient account: profile, persons, latest bookings, devices. */
export function usePlatformUserQuery(id: string, enabled = true) {
  return useQuery({
    enabled,
    queryKey: platformUsersKeys.detail(id),
    queryFn: async () => unwrap(await fetchPlatformUser(id)),
  });
}
