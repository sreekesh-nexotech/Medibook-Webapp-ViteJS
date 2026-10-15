import type { Result } from '@/core/error/failure';

import type { NumberingSeries } from '@/features/settings/domain/entities/settings.entities';
import { configRepository } from '@/features/settings/infrastructure/repositories/config.repository.impl';

export function fetchNumberingSeries(): Promise<Result<readonly NumberingSeries[]>> {
  return configRepository.listNumbering();
}
