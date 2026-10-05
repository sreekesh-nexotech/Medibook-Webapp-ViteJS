import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import {
  ROLES_STALE_TIME_MS,
  usersRolesKeys,
} from '@/features/users-roles/application/queries/usersRoles.keys';
import { fetchStaffRoles } from '@/features/users-roles/application/usecases/fetchStaffRoles';

/** The hospital's four system roles with their permission codes. */
export function useStaffRolesQuery() {
  return useQuery({
    queryKey: usersRolesKeys.roles(),
    queryFn: async () => unwrap(await fetchStaffRoles()),
    staleTime: ROLES_STALE_TIME_MS,
  });
}
