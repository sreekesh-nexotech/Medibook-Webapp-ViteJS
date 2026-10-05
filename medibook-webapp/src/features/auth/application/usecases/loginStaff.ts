import type { Result } from '@/core/error/failure';

import type {
  AuthSurface,
  LoginCredentials,
  StaffSession,
} from '@/features/auth/domain/entities/auth.types';
import { authRepository } from '@/features/auth/infrastructure/repositories/auth.repository.impl';

export function loginStaff(
  surface: AuthSurface,
  credentials: LoginCredentials,
): Promise<Result<StaffSession>> {
  return authRepository.login(surface, credentials);
}
