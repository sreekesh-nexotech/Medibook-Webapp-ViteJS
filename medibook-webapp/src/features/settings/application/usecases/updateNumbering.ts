import type { Result } from '@/core/error/failure';

import type {
  NumberingChanges,
  NumberingKind,
  NumberingSeries,
} from '@/features/settings/domain/entities/settings.entities';
import { settingsRepository } from '@/features/settings/infrastructure/repositories/settings.repository.impl';

export function updateNumbering(
  kind: NumberingKind,
  changes: NumberingChanges,
  version: number,
): Promise<Result<NumberingSeries>> {
  return settingsRepository.updateNumbering(kind, changes, version);
}
