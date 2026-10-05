import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import type { AuthSurface } from '@/features/auth/domain/entities/auth.types';
import { authKeys } from '@/features/auth/application/queries/auth.keys';
import type { NameChange } from '@/features/profile/domain/entities/profile.types';
import { updateName } from '@/features/profile/application/usecases/updateName';

interface UpdateNameInput {
  readonly surface: AuthSurface;
  readonly change: NameChange;
  readonly version: number;
}

/** Edit the user's own name; the returned session replaces the cached one. */
export function useUpdateNameMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ surface, change, version }: UpdateNameInput) =>
      unwrap(await updateName(surface, change, version)),
    onSuccess: (session) => {
      queryClient.setQueryData(authKeys.session(session.surface), session);
    },
    onError: (_error, { surface }) => {
      // A version conflict means the cached user is stale — re-read it.
      void queryClient.invalidateQueries({ queryKey: authKeys.session(surface) });
    },
  });
}
