import type { Result } from '@/core/error/failure';

import { opsSettingsRepository } from '@/features/ops-settings/infrastructure/repositories/opsSettings.repository.impl';

export function deleteOpsTaxRate(id: string, version: number): Promise<Result<null>> {
  return opsSettingsRepository.deleteTaxRate(id, version);
}
