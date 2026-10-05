import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import type { AuthSurface } from '@/features/auth/domain/entities/auth.types';
import { profileKeys } from '@/features/profile/application/queries/profile.keys';
import { revokeSession } from '@/features/profile/application/usecases/revokeSession';

interface RevokeSessionInput {
  readonly surface: AuthSurface;
  readonly sessionId: string;
}

/** Sign one other device out. */
export function useRevokeSessionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ surface, sessionId }: RevokeSessionInput) =>
      unwrap(await revokeSession(surface, sessionId)),
    onSettled: (_data, _error, { surface }) => {
      void queryClient.invalidateQueries({ queryKey: profileKeys.sessions(surface) });
    },
  });
}
