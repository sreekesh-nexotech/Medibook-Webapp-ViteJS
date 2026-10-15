import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';
import { useOpsPermission } from '@/shared/hooks/useOpsPermission';

import { opsUsersKeys } from '@/features/ops-users/application/queries/opsUsers.keys';
import { fetchOpsStaff } from '@/features/ops-users/application/usecases/fetchOpsStaff';

/** Status and last sign-in change often enough to refresh after a minute. */
const STAFF_STALE_TIME_MS = 60_000;

/**
 * Internal staff (`GET /platform/staff`), first page of up to 100. The read
 * needs `staff.view`; other screens use it only to name people, so roles
 * without it (ops manager, compliance, support) make no request (12·F17).
 * `enabled` lets a caller (the onboarding assignee picker) skip it further.
 */
export function useOpsStaffQuery(enabled = true) {
  const canView = useOpsPermission().can('staff.view');
  return useQuery({
    enabled: enabled && canView,
    queryKey: opsUsersKeys.staff(),
    queryFn: async () => unwrap(await fetchOpsStaff()),
    staleTime: STAFF_STALE_TIME_MS,
  });
}
