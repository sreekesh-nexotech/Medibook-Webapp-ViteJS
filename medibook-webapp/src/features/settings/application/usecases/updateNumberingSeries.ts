import type { Result } from '@/core/error/failure';

import type {
  NumberingChanges,
  NumberingSeries,
} from '@/features/settings/domain/entities/settings.entities';
import { configRepository } from '@/features/settings/infrastructure/repositories/config.repository.impl';

export function updateNumberingSeries(
  kind: string,
  changes: NumberingChanges,
  version: number,
): Promise<Result<NumberingSeries>> {
  return configRepository.updateNumbering(kind, changes, version);
}
