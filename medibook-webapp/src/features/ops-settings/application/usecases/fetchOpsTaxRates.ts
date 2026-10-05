import type { Result } from '@/core/error/failure';

import type {
  ConfigList,
  TaxRate,
} from '@/features/ops-settings/domain/entities/opsSettings.entity';
import { opsSettingsRepository } from '@/features/ops-settings/infrastructure/repositories/opsSettings.repository.impl';

export function fetchOpsTaxRates(): Promise<Result<ConfigList<TaxRate>>> {
  return opsSettingsRepository.listTaxRates();
}
