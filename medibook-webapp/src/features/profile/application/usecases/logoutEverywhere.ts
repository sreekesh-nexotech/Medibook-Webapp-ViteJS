import type { Result } from '@/core/error/failure';

import type { AuthSurface } from '@/features/auth/domain/entities/auth.types';
import { profileRepository } from '@/features/profile/infrastructure/repositories/profile.repository.impl';

export function logoutEverywhere(surface: AuthSurface): Promise<Result<null>> {
  return profileRepository.logoutEverywhere(surface);
}
