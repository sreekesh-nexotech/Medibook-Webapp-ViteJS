import type { Result } from '@/core/error/failure';

import type { PricedService } from '@/features/settings/domain/entities/services.entities';
import { servicesRepository } from '@/features/settings/infrastructure/repositories/services.repository.impl';

export function setServiceActive(
  id: string,
  isActive: boolean,
  version: number,
): Promise<Result<PricedService>> {
  return servicesRepository.setServiceActive(id, isActive, version);
}
