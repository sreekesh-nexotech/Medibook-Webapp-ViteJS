import type { Result } from '@/core/error/failure';

import type { AuthSurface } from '@/features/auth/domain/entities/auth.types';
import { authRepository } from '@/features/auth/infrastructure/repositories/auth.repository.impl';

export function resetPassword(
  surface: AuthSurface,
  token: string,
  newPassword: string,
): Promise<Result<null>> {
  return authRepository.resetPassword(surface, token, newPassword);
}
