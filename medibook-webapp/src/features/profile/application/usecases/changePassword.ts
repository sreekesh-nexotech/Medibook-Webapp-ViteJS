import type { Result } from '@/core/error/failure';

import type { AuthSurface } from '@/features/auth/domain/entities/auth.types';
import type { PasswordChange } from '@/features/profile/domain/entities/profile.types';
import { profileRepository } from '@/features/profile/infrastructure/repositories/profile.repository.impl';

export function changePassword(
  surface: AuthSurface,
  change: PasswordChange,
): Promise<Result<null>> {
  return profileRepository.changePassword(surface, change);
}
