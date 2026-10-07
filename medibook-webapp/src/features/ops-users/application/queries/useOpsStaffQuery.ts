import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { opsUsersKeys } from '@/features/ops-users/application/queries/opsUsers.keys';
import { fetchOpsStaff } from '@/features/ops-users/application/usecases/fetchOpsStaff';

/** Status and last sign-in change often enough to refresh after a minute. */
const STAFF_STALE_TIME_MS = 60_000;

/**
 * Internal staff (`GET /platform/staff`), first page of up to 100. `enabled`
 * lets other screens (the onboarding assignee picker) skip it for roles
 * without `staff.view`.
 */
export function useOpsStaffQuery(enabled = true) {
  return useQuery({
    enabled,
    queryKey: opsUsersKeys.staff(),
    queryFn: async () => unwrap(await fetchOpsStaff()),
    staleTime: STAFF_STALE_TIME_MS,
  });
}
