import type { Result } from '@/core/error/failure';

import type { Counter, CounterInput } from '@/features/settings/domain/entities/settings.entities';
import { configRepository } from '@/features/settings/infrastructure/repositories/config.repository.impl';

export function updateCounter(
  id: string,
  changes: Partial<CounterInput>,
  version: number,
): Promise<Result<Counter>> {
  return configRepository.updateCounter(id, changes, version);
}
