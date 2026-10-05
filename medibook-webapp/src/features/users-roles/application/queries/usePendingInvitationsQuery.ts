import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { usersRolesKeys } from '@/features/users-roles/application/queries/usersRoles.keys';
import { fetchPendingInvitations } from '@/features/users-roles/application/usecases/fetchPendingInvitations';

/**
 * Invitations not yet accepted. The backend gates this list on
 * `users_roles.add` (GET included), so pass `enabled: false` for a viewer
 * without it rather than collecting a 403.
 */
export function usePendingInvitationsQuery(enabled: boolean) {
  return useQuery({
    queryKey: usersRolesKeys.invitations(),
    queryFn: async () => unwrap(await fetchPendingInvitations()),
    enabled,
  });
}
