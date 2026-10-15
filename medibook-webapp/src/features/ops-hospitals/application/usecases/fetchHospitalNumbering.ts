import type { Result } from '@/core/error/failure';

import type {
  NumberingKind,
  NumberingSeries,
} from '@/features/ops-hospitals/domain/entities/hospitalSettings.entity';
import { hospitalSettingsRepository } from '@/features/ops-hospitals/infrastructure/repositories/hospitalSettings.repository.impl';

export function fetchHospitalNumbering(
  hospitalId: string,
  kind: NumberingKind,
): Promise<Result<NumberingSeries>> {
  return hospitalSettingsRepository.getNumbering(hospitalId, kind);
}
