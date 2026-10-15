import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { usersRolesKeys } from '@/features/users-roles/application/queries/usersRoles.keys';
import { fetchStaffMembers } from '@/features/users-roles/application/usecases/fetchStaffMembers';

/**
 * Staff change rarely and every edit here refreshes the list, so a large
 * hospital's full list (up to 50 pages) is not re-read on every visit (PERF-03).
 * The list needs `users_roles.view`; pass `enabled: false` for a viewer without
 * it rather than collecting a 403 (appendix 05 F18).
 */
const STAFF_STALE_TIME_MS = 5 * 60_000;

export function useStaffMembersQuery(enabled = true) {
  return useQuery({
    queryKey: usersRolesKeys.staff(),
    queryFn: async () => unwrap(await fetchStaffMembers()),
    enabled,
    staleTime: STAFF_STALE_TIME_MS,
  });
}
