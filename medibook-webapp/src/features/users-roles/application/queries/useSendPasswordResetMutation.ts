import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { usersRolesKeys } from '@/features/users-roles/application/queries/usersRoles.keys';
import { sendStaffPasswordReset } from '@/features/users-roles/application/usecases/sendStaffPasswordReset';

/** Email a staff member a password-reset link. */
export function useSendPasswordResetMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => unwrap(await sendStaffPasswordReset(id)),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: usersRolesKeys.staff() });
    },
  });
}
