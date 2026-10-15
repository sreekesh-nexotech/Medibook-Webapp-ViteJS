import type { Result } from '@/core/error/failure';

import { configRepository } from '@/features/settings/infrastructure/repositories/config.repository.impl';

export function deleteCounter(id: string, version: number): Promise<Result<null>> {
  return configRepository.deleteCounter(id, version);
}
