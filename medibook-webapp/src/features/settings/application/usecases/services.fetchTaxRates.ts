import type { Result } from '@/core/error/failure';

import type { ServiceTaxRate } from '@/features/settings/domain/entities/services.entities';
import { servicesRepository } from '@/features/settings/infrastructure/repositories/services.repository.impl';

export function fetchTaxRates(): Promise<Result<readonly ServiceTaxRate[]>> {
  return servicesRepository.listTaxRates();
}
