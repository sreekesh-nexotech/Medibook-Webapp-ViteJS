import type { Result } from '@/core/error/failure';

import type { AuthSurface } from '@/features/auth/domain/entities/auth.types';
import { profileRepository } from '@/features/profile/infrastructure/repositories/profile.repository.impl';

export function revokeSession(surface: AuthSurface, sessionId: string): Promise<Result<null>> {
  return profileRepository.revokeSession(surface, sessionId);
}
