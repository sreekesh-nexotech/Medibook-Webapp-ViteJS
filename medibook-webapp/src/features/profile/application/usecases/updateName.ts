import type { Result } from '@/core/error/failure';

import type { AuthSurface, StaffSession } from '@/features/auth/domain/entities/auth.types';
import type { NameChange } from '@/features/profile/domain/entities/profile.types';
import { profileRepository } from '@/features/profile/infrastructure/repositories/profile.repository.impl';

export function updateName(
  surface: AuthSurface,
  change: NameChange,
  version: number,
): Promise<Result<StaffSession>> {
  return profileRepository.updateName(surface, change, version);
}
