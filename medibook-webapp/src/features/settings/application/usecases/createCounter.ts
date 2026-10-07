import type { Result } from '@/core/error/failure';

import type { Counter, CounterInput } from '@/features/settings/domain/entities/settings.entities';
import { configRepository } from '@/features/settings/infrastructure/repositories/config.repository.impl';

export function createCounter(input: CounterInput): Promise<Result<Counter>> {
  return configRepository.createCounter(input);
}
