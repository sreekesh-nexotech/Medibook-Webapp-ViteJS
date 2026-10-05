import type { Result } from '@/core/error/failure';

import type {
  ServiceTaxRate,
  TaxRateInput,
} from '@/features/settings/domain/entities/services.entities';
import { servicesRepository } from '@/features/settings/infrastructure/repositories/services.repository.impl';

export function createTaxRate(input: TaxRateInput): Promise<Result<ServiceTaxRate>> {
  return servicesRepository.createTaxRate(input);
}
