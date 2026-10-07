import type { Result } from '@/core/error/failure';

import type { ServiceTaxRate } from '@/features/settings/domain/entities/services.entities';
import { servicesRepository } from '@/features/settings/infrastructure/repositories/services.repository.impl';

export function setTaxRateActive(
  id: string,
  isActive: boolean,
  version: number,
): Promise<Result<ServiceTaxRate>> {
  return servicesRepository.setTaxRateActive(id, isActive, version);
}
