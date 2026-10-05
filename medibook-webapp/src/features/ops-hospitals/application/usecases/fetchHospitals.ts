import type { Page } from '@/core/api/pagination';
import type { Result } from '@/core/error/failure';

import type {
  HospitalListQuery,
  PlatformHospital,
} from '@/features/ops-hospitals/domain/entities/hospitals.entity';
import { hospitalsRepository } from '@/features/ops-hospitals/infrastructure/repositories/hospitals.repository.impl';

export function fetchHospitals(query: HospitalListQuery): Promise<Result<Page<PlatformHospital>>> {
  return hospitalsRepository.listHospitals(query);
}
