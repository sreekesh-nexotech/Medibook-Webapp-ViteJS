import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { usersRolesKeys } from '@/features/users-roles/application/queries/usersRoles.keys';
import { updateRoleDescription } from '@/features/users-roles/application/usecases/updateRoleDescription';
import type { StaffRoleCode } from '@/features/users-roles/domain/entities/usersRoles.types';

interface UpdateRoleDescriptionInput {
  readonly roleCode: StaffRoleCode;
  readonly description: string | null;
  /** The role version edited, sent as `If-Match`. */
  readonly version: number;
}

/** Change a role's one-line description (USR-02; the hospital admin only). */
export function useUpdateRoleDescriptionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ roleCode, description, version }: UpdateRoleDescriptionInput) =>
      unwrap(await updateRoleDescription(roleCode, description, version)),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: usersRolesKeys.roles() });
    },
  });
}
