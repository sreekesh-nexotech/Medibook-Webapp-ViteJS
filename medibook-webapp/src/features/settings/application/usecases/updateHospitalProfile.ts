import type { Result } from '@/core/error/failure';

import type {
  HospitalProfile,
  HospitalProfileChanges,
} from '@/features/settings/domain/entities/settings.entities';
import { settingsRepository } from '@/features/settings/infrastructure/repositories/settings.repository.impl';

export function updateHospitalProfile(
  changes: HospitalProfileChanges,
  version: number,
): Promise<Result<HospitalProfile>> {
  return settingsRepository.updateProfile(changes, version);
}
