import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { usersRolesKeys } from '@/features/users-roles/application/queries/usersRoles.keys';
import { deactivateStaffMember } from '@/features/users-roles/application/usecases/deactivateStaffMember';

/** Deactivate a staff member; the server ends their sessions at once. */
export function useDeactivateStaffMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => unwrap(await deactivateStaffMember(id)),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: usersRolesKeys.staff() });
    },
  });
}
