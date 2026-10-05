import type { Result } from '@/core/error/failure';

import type { HospitalStatusCounts } from '@/features/ops-hospitals/domain/entities/hospitals.entity';
import { hospitalsRepository } from '@/features/ops-hospitals/infrastructure/repositories/hospitals.repository.impl';

export function fetchHospitalStatusCounts(): Promise<Result<HospitalStatusCounts>> {
  return hospitalsRepository.statusCounts();
}
