import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import type { TokenScope } from '@/features/settings/domain/entities/settings.entities';
import { settingsKeys } from '@/features/settings/application/queries/settings.keys';
import { updateTokenScope } from '@/features/settings/application/usecases/updateTokenScope';

interface UpdateTokenScopeInput {
  readonly scope: TokenScope;
  readonly version: number;
}

/** Change the token series scope — the server applies it from tomorrow. */
export function useUpdateTokenScopeMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ scope, version }: UpdateTokenScopeInput) =>
      unwrap(await updateTokenScope(scope, version)),
    onSuccess: (policy) => {
      queryClient.setQueryData(settingsKeys.tokenPolicy(), policy);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: settingsKeys.tokenPolicy() }),
  });
}
