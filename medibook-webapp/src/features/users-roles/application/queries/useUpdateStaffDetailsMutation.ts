import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { usersRolesKeys } from '@/features/users-roles/application/queries/usersRoles.keys';
import { updateStaffDetails } from '@/features/users-roles/application/usecases/updateStaffDetails';
import type { StaffDetailsDraft } from '@/features/users-roles/domain/entities/usersRoles.types';

interface UpdateStaffDetailsInput {
  readonly staffId: string;
  readonly details: StaffDetailsDraft;
  /** The row version the administrator was looking at. */
  readonly version: number;
}

/**
 * Change a staff member's role, employee code, designation or default counter
 * (the server keeps at least one active admin).
 */
export function useUpdateStaffDetailsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ staffId, details, version }: UpdateStaffDetailsInput) =>
      unwrap(await updateStaffDetails(staffId, details, version)),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: usersRolesKeys.staff() });
    },
  });
}
