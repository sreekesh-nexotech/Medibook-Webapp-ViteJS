import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { opsUsersKeys } from '@/features/ops-users/application/queries/opsUsers.keys';
import { changeOpsStaffRole } from '@/features/ops-users/application/usecases/changeOpsStaffRole';

interface ChangeRoleInput {
  readonly id: string;
  readonly roleId: string;
  /** The version the editor opened on; a stale one is refused with a conflict. */
  readonly version: number;
}

/** Move a member to another role. Refetches on any outcome, so a conflict shows the latest row. */
export function useChangeOpsStaffRoleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, roleId, version }: ChangeRoleInput) =>
      unwrap(await changeOpsStaffRole(id, roleId, version)),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: opsUsersKeys.staff() });
    },
  });
}
