import type { Result } from '@/core/error/failure';

import type { DataRequest } from '@/features/ops-compliance/domain/entities/compliance.entities';
import { complianceRepository } from '@/features/ops-compliance/infrastructure/repositories/compliance.repository.impl';

export function rejectComplianceDataRequest(
  id: string,
  reason: string,
): Promise<Result<DataRequest>> {
  return complianceRepository.rejectDataRequest(id, reason);
}
