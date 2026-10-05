import type { Result } from '@/core/error/failure';

import type { PlatformHospitalDetail } from '@/features/ops-hospitals/domain/entities/hospitals.entity';
import { hospitalsRepository } from '@/features/ops-hospitals/infrastructure/repositories/hospitals.repository.impl';

export function fetchHospital(id: string): Promise<Result<PlatformHospitalDetail>> {
  return hospitalsRepository.getHospital(id);
}
