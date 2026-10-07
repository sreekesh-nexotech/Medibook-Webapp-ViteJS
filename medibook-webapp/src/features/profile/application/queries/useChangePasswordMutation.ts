import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import type { AuthSurface } from '@/features/auth/domain/entities/auth.types';
import { authKeys } from '@/features/auth/application/queries/auth.keys';
import type { PasswordChange } from '@/features/profile/domain/entities/profile.types';
import { profileKeys } from '@/features/profile/application/queries/profile.keys';
import { changePassword } from '@/features/profile/application/usecases/changePassword';

interface ChangePasswordInput {
  readonly surface: AuthSurface;
  readonly change: PasswordChange;
}

/**
 * Change the password. Every other session is revoked, so the session list
 * is re-read. The password lives on the user row, so the change can bump its
 * `version`: the cached user is re-read too, or the next name save would send
 * a stale `If-Match` and fail with "changed by someone else" (UAT-69).
 */
export function useChangePasswordMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ surface, change }: ChangePasswordInput) =>
      unwrap(await changePassword(surface, change)),
    onSuccess: (_data, { surface }) => {
      void queryClient.invalidateQueries({ queryKey: profileKeys.sessions(surface) });
      void queryClient.invalidateQueries({ queryKey: authKeys.session(surface) });
    },
  });
}
