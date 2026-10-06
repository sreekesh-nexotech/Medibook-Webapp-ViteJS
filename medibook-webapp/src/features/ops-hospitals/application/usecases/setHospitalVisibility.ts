import type { Result } from '@/core/error/failure';

import type {
  HospitalAppVisibility,
  PlatformHospital,
} from '@/features/ops-hospitals/domain/entities/hospitals.entity';
import { hospitalsRepository } from '@/features/ops-hospitals/infrastructure/repositories/hospitals.repository.impl';

export function setHospitalVisibility(
  id: string,
  visibility: HospitalAppVisibility,
): Promise<Result<PlatformHospital>> {
  return hospitalsRepository.setVisibility(id, visibility);
}
