import type { Result } from '@/core/error/failure';

import type { AmbulanceProvider } from '@/features/ops-content/domain/entities/content.entities';
import { contentRepository } from '@/features/ops-content/infrastructure/repositories/content.repository.impl';

export function fetchAmbulanceProviders(): Promise<Result<readonly AmbulanceProvider[]>> {
  return contentRepository.listAmbulanceProviders();
}
