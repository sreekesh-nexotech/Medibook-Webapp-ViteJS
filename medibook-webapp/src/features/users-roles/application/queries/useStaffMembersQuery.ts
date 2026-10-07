import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { usersRolesKeys } from '@/features/users-roles/application/queries/usersRoles.keys';
import { fetchStaffMembers } from '@/features/users-roles/application/usecases/fetchStaffMembers';

/**
 * Every staff member of the signed-in hospital. The list needs
 * `users_roles.view`; pass `enabled: false` for a viewer without it rather
 * than collecting a 403 (appendix 05 F18).
 */
export function useStaffMembersQuery(enabled = true) {
  return useQuery({
    queryKey: usersRolesKeys.staff(),
    queryFn: async () => unwrap(await fetchStaffMembers()),
    enabled,
  });
}
