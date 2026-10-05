import { useMutation } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import type { AuthSurface } from '@/features/auth/domain/entities/auth.types';
import { resetPassword } from '@/features/auth/application/usecases/resetPassword';

interface PasswordResetInput {
  readonly surface: AuthSurface;
  readonly token: string;
  readonly newPassword: string;
}

/** Set a new password from an emailed reset link. Revokes every session server-side. */
export function usePasswordResetMutation() {
  return useMutation({
    mutationFn: async ({ surface, token, newPassword }: PasswordResetInput) =>
      unwrap(await resetPassword(surface, token, newPassword)),
  });
}
