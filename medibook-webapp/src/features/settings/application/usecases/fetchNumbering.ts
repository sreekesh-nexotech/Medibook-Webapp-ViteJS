import type { Result } from '@/core/error/failure';

import type { NumberingSeries } from '@/features/settings/domain/entities/settings.entities';
import { settingsRepository } from '@/features/settings/infrastructure/repositories/settings.repository.impl';

export function fetchNumbering(): Promise<Result<readonly NumberingSeries[]>> {
  return settingsRepository.listNumbering();
}
