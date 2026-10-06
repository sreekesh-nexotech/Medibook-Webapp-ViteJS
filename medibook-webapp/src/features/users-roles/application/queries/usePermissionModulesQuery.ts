import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import {
  ROLES_STALE_TIME_MS,
  usersRolesKeys,
} from '@/features/users-roles/application/queries/usersRoles.keys';
import { fetchPermissionModules } from '@/features/users-roles/application/usecases/fetchPermissionModules';

/** Every module a role can be granted, from the backend's permission catalogue. */
export function usePermissionModulesQuery() {
  return useQuery({
    queryKey: usersRolesKeys.permissionModules(),
    queryFn: async () => unwrap(await fetchPermissionModules()),
    staleTime: ROLES_STALE_TIME_MS,
  });
}
