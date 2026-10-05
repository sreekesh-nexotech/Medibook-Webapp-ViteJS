import { useMutation } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import type { AuthSurface } from '@/features/auth/domain/entities/auth.types';
import { requestPasswordReset } from '@/features/auth/application/usecases/requestPasswordReset';

interface PasswordForgotInput {
  readonly surface: AuthSurface;
  readonly email: string;
}

/** Request a reset link. Succeeds for any well-formed email (no account enumeration). */
export function usePasswordForgotMutation() {
  return useMutation({
    mutationFn: async ({ surface, email }: PasswordForgotInput) =>
      unwrap(await requestPasswordReset(surface, email)),
  });
}
