import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { opsUsersKeys } from '@/features/ops-users/application/queries/opsUsers.keys';
import { createOpsRole } from '@/features/ops-users/application/usecases/createOpsRole';
import { updateOpsRole } from '@/features/ops-users/application/usecases/updateOpsRole';
import type {
  OpsRoleChanges,
  OpsRoleDraft,
  OpsStaffRole,
} from '@/features/ops-users/domain/entities/opsUsers.types';

/** Create a role, or edit one (rename and/or a new grid) at the version it was opened on. */
export type SaveOpsRoleInput =
  | { readonly kind: 'create'; readonly draft: OpsRoleDraft }
  | {
      readonly kind: 'update';
      readonly id: string;
      readonly changes: OpsRoleChanges;
      readonly version: number;
    };

/**
 * Save a platform role. Roles and staff are both refetched: a grid change
 * moves what every member on the role may do, and the staff list shows roles.
 */
export function useSaveOpsRoleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: SaveOpsRoleInput): Promise<OpsStaffRole> =>
      unwrap(
        input.kind === 'create'
          ? await createOpsRole(input.draft)
          : await updateOpsRole(input.id, input.changes, input.version),
      ),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: opsUsersKeys.roles() });
      void queryClient.invalidateQueries({ queryKey: opsUsersKeys.staff() });
    },
  });
}
