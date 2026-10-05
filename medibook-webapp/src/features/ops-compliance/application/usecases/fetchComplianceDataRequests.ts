import type { Page } from '@/core/api/pagination';
import type { Result } from '@/core/error/failure';

import type {
  DataRequest,
  DataRequestParams,
} from '@/features/ops-compliance/domain/entities/compliance.entities';
import { complianceRepository } from '@/features/ops-compliance/infrastructure/repositories/compliance.repository.impl';

export function fetchComplianceDataRequests(
  params: DataRequestParams,
): Promise<Result<Page<DataRequest>>> {
  return complianceRepository.listDataRequests(params);
}
