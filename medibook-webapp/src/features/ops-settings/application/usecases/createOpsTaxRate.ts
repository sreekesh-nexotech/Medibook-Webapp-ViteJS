import type { Result } from '@/core/error/failure';

import type {
  TaxRate,
  TaxRateValues,
} from '@/features/ops-settings/domain/entities/opsSettings.entity';
import { opsSettingsRepository } from '@/features/ops-settings/infrastructure/repositories/opsSettings.repository.impl';

export function createOpsTaxRate(values: TaxRateValues): Promise<Result<TaxRate>> {
  return opsSettingsRepository.createTaxRate(values);
}
