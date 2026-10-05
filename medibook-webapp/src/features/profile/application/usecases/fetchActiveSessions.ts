import type { Result } from '@/core/error/failure';

import type { AuthSurface } from '@/features/auth/domain/entities/auth.types';
import type { ActiveSession } from '@/features/profile/domain/entities/profile.types';
import { profileRepository } from '@/features/profile/infrastructure/repositories/profile.repository.impl';

export function fetchActiveSessions(
  surface: AuthSurface,
): Promise<Result<readonly ActiveSession[]>> {
  return profileRepository.listSessions(surface);
}
