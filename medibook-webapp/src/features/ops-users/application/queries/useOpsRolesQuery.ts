import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { opsUsersKeys } from '@/features/ops-users/application/queries/opsUsers.keys';
import { fetchOpsRoles } from '@/features/ops-users/application/usecases/fetchOpsRoles';

/** Roles and their grids change rarely. */
const ROLES_STALE_TIME_MS = 5 * 60_000;

/** Platform roles with their permission codes (`GET /platform/roles`). */
export function useOpsRolesQuery() {
  return useQuery({
    queryKey: opsUsersKeys.roles(),
    queryFn: async () => unwrap(await fetchOpsRoles()),
    staleTime: ROLES_STALE_TIME_MS,
  });
}
