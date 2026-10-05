import type { Result } from '@/core/error/failure';

import type { DataRequestProcessOutcome } from '@/features/ops-compliance/domain/entities/compliance.entities';
import { complianceRepository } from '@/features/ops-compliance/infrastructure/repositories/compliance.repository.impl';

export function processComplianceDataRequest(
  id: string,
): Promise<Result<DataRequestProcessOutcome>> {
  return complianceRepository.processDataRequest(id);
}
