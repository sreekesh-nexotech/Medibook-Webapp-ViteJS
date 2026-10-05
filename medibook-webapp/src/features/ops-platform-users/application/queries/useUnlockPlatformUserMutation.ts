import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { platformUsersKeys } from '@/features/ops-platform-users/application/queries/platformUsers.keys';
import { unlockPlatformUser } from '@/features/ops-platform-users/application/usecases/unlockPlatformUser';

/** Clear the account's failed-sign-in lockout. Refreshes the list, the counts and the account. */
export function useUnlockPlatformUserMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => unwrap(await unlockPlatformUser(id)),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: platformUsersKeys.all });
    },
  });
}
