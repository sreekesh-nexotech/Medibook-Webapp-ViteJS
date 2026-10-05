import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { opsUsersKeys } from '@/features/ops-users/application/queries/opsUsers.keys';
import { reactivateOpsStaff } from '@/features/ops-users/application/usecases/reactivateOpsStaff';

/** Restore a deactivated member's access. */
export function useReactivateOpsStaffMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => unwrap(await reactivateOpsStaff(id)),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: opsUsersKeys.staff() });
    },
  });
}
