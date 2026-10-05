import type { Result } from '@/core/error/failure';

import type { PlatformHospital } from '@/features/ops-hospitals/domain/entities/hospitals.entity';
import { hospitalsRepository } from '@/features/ops-hospitals/infrastructure/repositories/hospitals.repository.impl';

export function reinstateHospital(id: string): Promise<Result<PlatformHospital>> {
  return hospitalsRepository.reinstateHospital(id);
}
