import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';
import { useOpsPermission } from '@/shared/hooks/useOpsPermission';

import { opsUsersKeys } from '@/features/ops-users/application/queries/opsUsers.keys';
import { fetchAssignableStaff } from '@/features/ops-users/application/usecases/fetchAssignableStaff';

/** Staff join and leave rarely; a few minutes keeps the picker current. */
const ASSIGNABLE_STALE_TIME_MS = 5 * 60_000;

/**
 * Active staff a ticket or onboarding case can be assigned to
 * (`GET /platform/staff/assignable`, first page of up to 100). Readable with
 * any of `support.edit`, `onboarding.edit` or `staff.view`, so support and
 * operations managers get a picker without the full staff list; other roles
 * make no request. `enabled` lets a caller skip it further.
 */
export function useAssignableStaffQuery(enabled = true) {
  const { can } = useOpsPermission();
  const allowed = can('support.edit') || can('onboarding.edit') || can('staff.view');
  return useQuery({
    enabled: enabled && allowed,
    queryKey: opsUsersKeys.assignable(),
    queryFn: async () => unwrap(await fetchAssignableStaff()),
    staleTime: ASSIGNABLE_STALE_TIME_MS,
  });
}
