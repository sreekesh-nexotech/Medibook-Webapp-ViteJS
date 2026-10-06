import type { Result } from '@/core/error/failure';

import type {
  HospitalCommissionChange,
  PlatformHospital,
} from '@/features/ops-hospitals/domain/entities/hospitals.entity';
import { hospitalsRepository } from '@/features/ops-hospitals/infrastructure/repositories/hospitals.repository.impl';

export function setHospitalCommission(
  id: string,
  change: HospitalCommissionChange,
): Promise<Result<PlatformHospital>> {
  return hospitalsRepository.setCommission(id, change);
}
