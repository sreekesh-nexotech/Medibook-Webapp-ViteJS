import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { usersRolesKeys } from '@/features/users-roles/application/queries/usersRoles.keys';
import { fetchStaffMembers } from '@/features/users-roles/application/usecases/fetchStaffMembers';

/** Every staff member of the signed-in hospital. */
export function useStaffMembersQuery() {
  return useQuery({
    queryKey: usersRolesKeys.staff(),
    queryFn: async () => unwrap(await fetchStaffMembers()),
  });
}
