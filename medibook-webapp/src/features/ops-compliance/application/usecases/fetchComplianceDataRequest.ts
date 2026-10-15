import type { Result } from '@/core/error/failure';

import type { DataRequest } from '@/features/ops-compliance/domain/entities/compliance.entities';
import { complianceRepository } from '@/features/ops-compliance/infrastructure/repositories/compliance.repository.impl';

export function fetchComplianceDataRequest(id: string): Promise<Result<DataRequest>> {
  return complianceRepository.getDataRequest(id);
}
