import type { Result } from '@/core/error/failure';

import type {
  HospitalSuspendReason,
  PlatformHospital,
} from '@/features/ops-hospitals/domain/entities/hospitals.entity';
import { hospitalsRepository } from '@/features/ops-hospitals/infrastructure/repositories/hospitals.repository.impl';

export function suspendHospital(
  id: string,
  reason: HospitalSuspendReason,
  note: string | null,
): Promise<Result<PlatformHospital>> {
  return hospitalsRepository.suspendHospital(id, reason, note);
}
