import type { Result } from '@/core/error/failure';

import type {
  HospitalCreateInput,
  PlatformHospital,
} from '@/features/ops-hospitals/domain/entities/hospitals.entity';
import { hospitalsRepository } from '@/features/ops-hospitals/infrastructure/repositories/hospitals.repository.impl';

export function createHospital(input: HospitalCreateInput): Promise<Result<PlatformHospital>> {
  return hospitalsRepository.createHospital(input);
}
