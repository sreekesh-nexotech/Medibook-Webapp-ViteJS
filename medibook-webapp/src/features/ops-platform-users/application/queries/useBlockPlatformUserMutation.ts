import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { platformUsersKeys } from '@/features/ops-platform-users/application/queries/platformUsers.keys';
import { blockPlatformUser } from '@/features/ops-platform-users/application/usecases/blockPlatformUser';

interface BlockPlatformUserInput {
  readonly id: string;
  readonly reason: string;
}

/** Block the account (revokes its sessions). Refreshes the list, the counts and the account. */
export function useBlockPlatformUserMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: BlockPlatformUserInput) =>
      unwrap(await blockPlatformUser(id, reason)),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: platformUsersKeys.all });
    },
  });
}
