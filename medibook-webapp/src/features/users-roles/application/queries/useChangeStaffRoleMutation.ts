import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { usersRolesKeys } from '@/features/users-roles/application/queries/usersRoles.keys';
import { changeStaffRole } from '@/features/users-roles/application/usecases/changeStaffRole';
import type { StaffRoleCode } from '@/features/users-roles/domain/entities/usersRoles.types';

interface ChangeStaffRoleInput {
  readonly staffId: string;
  readonly roleCode: StaffRoleCode;
  /** The row version the administrator was looking at. */
  readonly version: number;
}

/** Move a staff member to another role (the server keeps at least one active admin). */
export function useChangeStaffRoleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ staffId, roleCode, version }: ChangeStaffRoleInput) =>
      unwrap(await changeStaffRole(staffId, roleCode, version)),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: usersRolesKeys.staff() });
    },
  });
}
