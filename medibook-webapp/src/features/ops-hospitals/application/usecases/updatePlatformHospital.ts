import type { Result } from '@/core/error/failure';

import type {
  HospitalProfileChanges,
  PlatformHospitalDetail,
} from '@/features/ops-hospitals/domain/entities/hospitals.entity';
import { hospitalsRepository } from '@/features/ops-hospitals/infrastructure/repositories/hospitals.repository.impl';

export function updatePlatformHospital(
  id: string,
  changes: HospitalProfileChanges,
  version: number,
): Promise<Result<PlatformHospitalDetail>> {
  return hospitalsRepository.updateHospital(id, changes, version);
}
