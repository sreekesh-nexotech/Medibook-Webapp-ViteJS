import type { Result } from '@/core/error/failure';

import type {
  PricedService,
  ServiceInput,
} from '@/features/settings/domain/entities/services.entities';
import { servicesRepository } from '@/features/settings/infrastructure/repositories/services.repository.impl';

export function createService(input: ServiceInput): Promise<Result<PricedService>> {
  return servicesRepository.createService(input);
}
