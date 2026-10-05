import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { usersRolesKeys } from '@/features/users-roles/application/queries/usersRoles.keys';
import { resendStaffInvitation } from '@/features/users-roles/application/usecases/resendStaffInvitation';

/** Send a pending invitation again with a fresh link. */
export function useResendInvitationMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => unwrap(await resendStaffInvitation(id)),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: usersRolesKeys.invitations() });
    },
  });
}
