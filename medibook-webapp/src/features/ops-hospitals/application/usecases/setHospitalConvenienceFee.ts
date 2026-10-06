import type { Result } from '@/core/error/failure';

import type {
  HospitalConvenienceFeeChange,
  PlatformHospital,
} from '@/features/ops-hospitals/domain/entities/hospitals.entity';
import { hospitalsRepository } from '@/features/ops-hospitals/infrastructure/repositories/hospitals.repository.impl';

export function setHospitalConvenienceFee(
  id: string,
  change: HospitalConvenienceFeeChange,
): Promise<Result<PlatformHospital>> {
  return hospitalsRepository.setConvenienceFee(id, change);
}
