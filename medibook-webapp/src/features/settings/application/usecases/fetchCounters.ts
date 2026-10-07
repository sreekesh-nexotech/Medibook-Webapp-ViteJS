import type { Result } from '@/core/error/failure';

import type { Counter } from '@/features/settings/domain/entities/settings.entities';
import { configRepository } from '@/features/settings/infrastructure/repositories/config.repository.impl';

export function fetchCounters(): Promise<Result<readonly Counter[]>> {
  return configRepository.listCounters();
}
