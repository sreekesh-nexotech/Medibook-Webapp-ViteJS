import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import type { AuthSurface } from '@/features/auth/domain/entities/auth.types';
import type { PasswordChange } from '@/features/profile/domain/entities/profile.types';
import { profileKeys } from '@/features/profile/application/queries/profile.keys';
import { changePassword } from '@/features/profile/application/usecases/changePassword';

interface ChangePasswordInput {
  readonly surface: AuthSurface;
  readonly change: PasswordChange;
}

/** Change the password. Every other session is revoked, so the session list is re-read. */
export function useChangePasswordMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ surface, change }: ChangePasswordInput) =>
      unwrap(await changePassword(surface, change)),
    onSuccess: (_data, { surface }) => {
      void queryClient.invalidateQueries({ queryKey: profileKeys.sessions(surface) });
    },
  });
}
