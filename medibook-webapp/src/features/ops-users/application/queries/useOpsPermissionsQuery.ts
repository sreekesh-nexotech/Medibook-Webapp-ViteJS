import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { opsUsersKeys } from '@/features/ops-users/application/queries/opsUsers.keys';
import { fetchOpsPermissions } from '@/features/ops-users/application/usecases/fetchOpsPermissions';

/** The catalogue is seeded reference data; it does not change while the app runs. */
const PERMISSIONS_STALE_TIME_MS = Infinity;

/** The platform permission catalogue (`GET /platform/permissions`). */
export function useOpsPermissionsQuery() {
  return useQuery({
    queryKey: opsUsersKeys.permissions(),
    queryFn: async () => unwrap(await fetchOpsPermissions()),
    staleTime: PERMISSIONS_STALE_TIME_MS,
  });
}
