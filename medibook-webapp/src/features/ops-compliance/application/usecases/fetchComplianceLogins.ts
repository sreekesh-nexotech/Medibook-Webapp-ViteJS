import type { Page } from '@/core/api/pagination';
import type { Result } from '@/core/error/failure';

import type {
  LoginEvent,
  LoginHistoryParams,
} from '@/features/ops-compliance/domain/entities/compliance.entities';
import { complianceRepository } from '@/features/ops-compliance/infrastructure/repositories/compliance.repository.impl';

export function fetchComplianceLogins(
  params: LoginHistoryParams,
): Promise<Result<Page<LoginEvent>>> {
  return complianceRepository.listLoginHistory(params);
}
