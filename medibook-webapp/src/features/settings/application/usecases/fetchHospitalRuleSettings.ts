import type { Result } from '@/core/error/failure';

import type { HospitalRuleSettings } from '@/features/settings/domain/entities/settings.entities';
import { settingsRepository } from '@/features/settings/infrastructure/repositories/settings.repository.impl';

export function fetchHospitalRuleSettings(): Promise<Result<HospitalRuleSettings>> {
  return settingsRepository.getRuleSettings();
}
