import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { opsUsersKeys } from '@/features/ops-users/application/queries/opsUsers.keys';
import { deactivateOpsStaff } from '@/features/ops-users/application/usecases/deactivateOpsStaff';

/** Deactivate a member and revoke every session they hold. */
export function useDeactivateOpsStaffMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => unwrap(await deactivateOpsStaff(id)),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: opsUsersKeys.staff() });
    },
  });
}
