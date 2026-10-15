import type { Result } from '@/core/error/failure';

import type { CommissionHistory } from '@/features/ops-hospitals/domain/entities/hospitals.entity';
import { hospitalsRepository } from '@/features/ops-hospitals/infrastructure/repositories/hospitals.repository.impl';

export function fetchCommissionHistory(
  hospitalId: string,
): Promise<Result<CommissionHistory | null>> {
  return hospitalsRepository.getCommissionHistory(hospitalId);
}
