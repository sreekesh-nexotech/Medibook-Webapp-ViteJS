import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { usersRolesKeys } from '@/features/users-roles/application/queries/usersRoles.keys';
import { updateRolePermissions } from '@/features/users-roles/application/usecases/updateRolePermissions';
import type { StaffRoleCode } from '@/features/users-roles/domain/entities/usersRoles.types';

interface UpdateRolePermissionsInput {
  readonly roleCode: StaffRoleCode;
  /** The complete set the role should hold afterwards — it replaces the current one. */
  readonly permissions: readonly string[];
  /** The role version edited, sent as `If-Match` when known. */
  readonly version: number | null;
}

/** Replace one role's permission grid (`admin` is not editable). */
export function useUpdateRolePermissionsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ roleCode, permissions, version }: UpdateRolePermissionsInput) =>
      unwrap(await updateRolePermissions(roleCode, permissions, version)),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: usersRolesKeys.roles() });
      void queryClient.invalidateQueries({ queryKey: usersRolesKeys.previews() });
    },
  });
}
