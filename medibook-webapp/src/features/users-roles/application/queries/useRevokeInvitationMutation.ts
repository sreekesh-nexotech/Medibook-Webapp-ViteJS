import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { usersRolesKeys } from '@/features/users-roles/application/queries/usersRoles.keys';
import { revokeStaffInvitation } from '@/features/users-roles/application/usecases/revokeStaffInvitation';

/** Cancel a pending invitation; its link stops working. */
export function useRevokeInvitationMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => unwrap(await revokeStaffInvitation(id)),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: usersRolesKeys.invitations() });
    },
  });
}
