import type { Result } from '@/core/error/failure';

import type {
  PricedService,
  ServiceInput,
} from '@/features/settings/domain/entities/services.entities';
import { servicesRepository } from '@/features/settings/infrastructure/repositories/services.repository.impl';

export function updateService(
  id: string,
  input: ServiceInput,
  version: number,
): Promise<Result<PricedService>> {
  return servicesRepository.updateService(id, input, version);
}
