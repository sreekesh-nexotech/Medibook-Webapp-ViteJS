import type { QueryClient } from '@tanstack/react-query';

import { usersRolesKeys } from '@/features/users-roles/application/queries/usersRoles.keys';
import type { StaffRole } from '@/features/users-roles/domain/entities/usersRoles.types';

/**
 * Put the role the server just saved into the cached role list at once. The
 * list is refetched afterwards, but a role opened again before that refetch
 * lands showed the old grid — and saving it would have put the old grid back
 * (UAT A-10).
 */
export function applySavedRole(queryClient: QueryClient, saved: StaffRole): void {
  queryClient.setQueryData<readonly StaffRole[]>(usersRolesKeys.roles(), (roles) =>
    roles?.map((role) => (role.code === saved.code ? saved : role)),
  );
}
