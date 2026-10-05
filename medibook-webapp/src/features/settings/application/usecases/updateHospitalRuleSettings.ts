import type { Result } from '@/core/error/failure';

import type {
  HospitalRuleChanges,
  HospitalRuleSettings,
} from '@/features/settings/domain/entities/settings.entities';
import { settingsRepository } from '@/features/settings/infrastructure/repositories/settings.repository.impl';

export function updateHospitalRuleSettings(
  changes: HospitalRuleChanges,
  version: number,
): Promise<Result<HospitalRuleSettings>> {
  return settingsRepository.updateRuleSettings(changes, version);
}
