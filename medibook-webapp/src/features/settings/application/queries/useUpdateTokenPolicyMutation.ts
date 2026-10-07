import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import type { TokenPolicyChanges } from '@/features/settings/domain/entities/settings.entities';
import { settingsKeys } from '@/features/settings/application/queries/settings.keys';
import { updateTokenPolicy } from '@/features/settings/application/usecases/updateTokenPolicy';

interface UpdateTokenPolicyInput {
  readonly changes: TokenPolicyChanges;
  readonly version: number;
}

/** Change the token policy — scope and reset apply from tomorrow, the rest at once. */
export function useUpdateTokenPolicyMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ changes, version }: UpdateTokenPolicyInput) =>
      unwrap(await updateTokenPolicy(changes, version)),
    onSuccess: (policy) => {
      queryClient.setQueryData(settingsKeys.tokenPolicy(), policy);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: settingsKeys.tokenPolicy() }),
  });
}
