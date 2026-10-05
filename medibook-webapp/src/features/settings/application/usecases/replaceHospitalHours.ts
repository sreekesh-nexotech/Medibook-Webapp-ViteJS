import type { Result } from '@/core/error/failure';

import type { HospitalHoursDay } from '@/features/settings/domain/entities/settings.entities';
import { settingsRepository } from '@/features/settings/infrastructure/repositories/settings.repository.impl';

export function replaceHospitalHours(
  days: readonly HospitalHoursDay[],
): Promise<Result<readonly HospitalHoursDay[]>> {
  return settingsRepository.replaceHours(days);
}
