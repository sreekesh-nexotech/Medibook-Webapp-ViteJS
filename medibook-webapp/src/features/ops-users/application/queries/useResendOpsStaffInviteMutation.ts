import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { opsUsersKeys } from '@/features/ops-users/application/queries/opsUsers.keys';
import { resendOpsStaffInvite } from '@/features/ops-users/application/usecases/resendOpsStaffInvite';

/** Email an invited member a fresh set-password link (rate limited on the server). */
export function useResendOpsStaffInviteMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => unwrap(await resendOpsStaffInvite(id)),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: opsUsersKeys.staff() });
    },
  });
}
