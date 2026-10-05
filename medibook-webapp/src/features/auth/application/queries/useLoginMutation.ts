import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import type { AuthSurface, LoginCredentials } from '@/features/auth/domain/entities/auth.types';
import { authKeys } from '@/features/auth/application/queries/auth.keys';
import { loginStaff } from '@/features/auth/application/usecases/loginStaff';

interface LoginInput {
  readonly surface: AuthSurface;
  readonly credentials: LoginCredentials;
}

/**
 * Sign in. Before the new session is cached, every cached query is dropped so
 * nothing of a previous user's data survives into the next one.
 */
export function useLoginMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ surface, credentials }: LoginInput) =>
      unwrap(await loginStaff(surface, credentials)),
    onSuccess: (session) => {
      queryClient.clear();
      queryClient.setQueryData(authKeys.session(session.surface), session);
    },
  });
}
