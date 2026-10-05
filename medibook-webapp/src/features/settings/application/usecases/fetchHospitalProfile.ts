import type { Result } from '@/core/error/failure';

import type { HospitalProfile } from '@/features/settings/domain/entities/settings.entities';
import { settingsRepository } from '@/features/settings/infrastructure/repositories/settings.repository.impl';

export function fetchHospitalProfile(): Promise<Result<HospitalProfile>> {
  return settingsRepository.getProfile();
}
