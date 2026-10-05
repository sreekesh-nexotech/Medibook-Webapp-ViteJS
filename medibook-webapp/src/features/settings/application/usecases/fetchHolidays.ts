import type { Result } from '@/core/error/failure';

import type { Holiday } from '@/features/settings/domain/entities/profile.entities';
import { profileRepository } from '@/features/settings/infrastructure/repositories/profile.repository.impl';

export function fetchHolidays(): Promise<Result<readonly Holiday[]>> {
  return profileRepository.listHolidays();
}
