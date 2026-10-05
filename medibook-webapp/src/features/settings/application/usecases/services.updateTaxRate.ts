import type { Result } from '@/core/error/failure';

import type {
  ServiceTaxRate,
  TaxRateInput,
} from '@/features/settings/domain/entities/services.entities';
import { servicesRepository } from '@/features/settings/infrastructure/repositories/services.repository.impl';

export function updateTaxRate(
  id: string,
  input: TaxRateInput,
  version: number,
): Promise<Result<ServiceTaxRate>> {
  return servicesRepository.updateTaxRate(id, input, version);
}
