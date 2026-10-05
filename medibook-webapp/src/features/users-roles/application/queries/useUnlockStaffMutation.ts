import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { usersRolesKeys } from '@/features/users-roles/application/queries/usersRoles.keys';
import { unlockStaffMember } from '@/features/users-roles/application/usecases/unlockStaffMember';

/** Clear a staff member's sign-in lockout. */
export function useUnlockStaffMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => unwrap(await unlockStaffMember(id)),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: usersRolesKeys.staff() });
    },
  });
}
