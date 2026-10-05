import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import type { OpsStaffInvite } from '@/features/ops-users/domain/entities/opsUsers.types';
import { opsUsersKeys } from '@/features/ops-users/application/queries/opsUsers.keys';
import { inviteOpsStaff } from '@/features/ops-users/application/usecases/inviteOpsStaff';

/** Invite a new internal user; the backend emails the set-password link. */
export function useInviteOpsStaffMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (invite: OpsStaffInvite) => unwrap(await inviteOpsStaff(invite)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: opsUsersKeys.staff() });
    },
  });
}
