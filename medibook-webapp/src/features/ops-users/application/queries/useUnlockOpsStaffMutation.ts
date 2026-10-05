import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { opsUsersKeys } from '@/features/ops-users/application/queries/opsUsers.keys';
import { unlockOpsStaff } from '@/features/ops-users/application/usecases/unlockOpsStaff';

/** Clear a member's sign-in lockout. */
export function useUnlockOpsStaffMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => unwrap(await unlockOpsStaff(id)),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: opsUsersKeys.staff() });
    },
  });
}
