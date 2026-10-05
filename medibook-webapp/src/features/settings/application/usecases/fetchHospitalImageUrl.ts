import type { Result } from '@/core/error/failure';

import { settingsRepository } from '@/features/settings/infrastructure/repositories/settings.repository.impl';

export function fetchHospitalImageUrl(fileId: string): Promise<Result<string>> {
  return settingsRepository.getImageUrl(fileId);
}
