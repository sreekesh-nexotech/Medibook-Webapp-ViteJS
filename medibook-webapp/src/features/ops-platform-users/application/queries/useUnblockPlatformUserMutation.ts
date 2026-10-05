import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { platformUsersKeys } from '@/features/ops-platform-users/application/queries/platformUsers.keys';
import { unblockPlatformUser } from '@/features/ops-platform-users/application/usecases/unblockPlatformUser';

/** Let a blocked account book again. Refreshes the list, the counts and the account. */
export function useUnblockPlatformUserMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => unwrap(await unblockPlatformUser(id)),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: platformUsersKeys.all });
    },
  });
}
