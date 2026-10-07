import type { Result } from '@/core/error/failure';

import type {
  NumberingChange,
  NumberingKind,
  NumberingSeries,
} from '@/features/ops-hospitals/domain/entities/hospitalSettings.entity';
import { hospitalSettingsRepository } from '@/features/ops-hospitals/infrastructure/repositories/hospitalSettings.repository.impl';

export function updateHospitalNumbering(
  hospitalId: string,
  kind: NumberingKind,
  change: NumberingChange,
  version: number,
): Promise<Result<NumberingSeries>> {
  return hospitalSettingsRepository.updateNumbering(hospitalId, kind, change, version);
}
