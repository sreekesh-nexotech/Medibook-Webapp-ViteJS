import type { Page } from '@/core/api/pagination';
import type { Result } from '@/core/error/failure';

import type {
  PhiAccessEntry,
  PhiAccessParams,
} from '@/features/ops-compliance/domain/entities/compliance.entities';
import { complianceRepository } from '@/features/ops-compliance/infrastructure/repositories/compliance.repository.impl';

export function fetchCompliancePhiAccess(
  params: PhiAccessParams,
): Promise<Result<Page<PhiAccessEntry>>> {
  return complianceRepository.listPhiAccess(params);
}
