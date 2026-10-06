import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import {
  ROLES_STALE_TIME_MS,
  usersRolesKeys,
} from '@/features/users-roles/application/queries/usersRoles.keys';
import { fetchStaffCounters } from '@/features/users-roles/application/usecases/fetchStaffCounters';

/** The hospital's counters — names for a staff member's default counter. */
export function useStaffCountersQuery() {
  return useQuery({
    queryKey: usersRolesKeys.counters(),
    queryFn: async () => unwrap(await fetchStaffCounters()),
    staleTime: ROLES_STALE_TIME_MS,
  });
}
