import type { Result } from '@/core/error/failure';

import type { AuthSurface } from '@/features/auth/domain/entities/auth.types';
import { authRepository } from '@/features/auth/infrastructure/repositories/auth.repository.impl';

export function logoutStaff(surface: AuthSurface): Promise<Result<null>> {
  return authRepository.logout(surface);
}
