import type { Result } from '@/core/error/failure';

import type { AuthSurface, StaffSession } from '@/features/auth/domain/entities/auth.types';
import { authRepository } from '@/features/auth/infrastructure/repositories/auth.repository.impl';

export function fetchSession(surface: AuthSurface): Promise<Result<StaffSession>> {
  return authRepository.getSession(surface);
}
