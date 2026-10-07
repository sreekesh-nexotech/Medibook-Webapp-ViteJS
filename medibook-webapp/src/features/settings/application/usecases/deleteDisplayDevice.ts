import type { Result } from '@/core/error/failure';

import { configRepository } from '@/features/settings/infrastructure/repositories/config.repository.impl';

export function deleteDisplayDevice(id: string, version: number): Promise<Result<null>> {
  return configRepository.deleteDisplayDevice(id, version);
}
