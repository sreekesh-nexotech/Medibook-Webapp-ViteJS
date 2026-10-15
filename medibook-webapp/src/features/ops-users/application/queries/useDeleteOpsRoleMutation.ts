import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { opsUsersKeys } from '@/features/ops-users/application/queries/opsUsers.keys';
import { deleteOpsRole } from '@/features/ops-users/application/usecases/deleteOpsRole';

interface DeleteRoleInput {
  readonly id: string;
  readonly version: number;
}

/** Delete a custom role nobody holds (system roles and roles in use are refused). */
export function useDeleteOpsRoleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, version }: DeleteRoleInput) =>
      unwrap(await deleteOpsRole(id, version)),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: opsUsersKeys.roles() });
    },
  });
}
