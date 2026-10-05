import type { Result } from '@/core/error/failure';

import type {
  ComplianceExportRows,
  LoginEvent,
  LoginHistoryFilters,
} from '@/features/ops-compliance/domain/entities/compliance.entities';
import { complianceRepository } from '@/features/ops-compliance/infrastructure/repositories/compliance.repository.impl';

export function exportComplianceLogins(
  filters: LoginHistoryFilters,
): Promise<Result<ComplianceExportRows<LoginEvent>>> {
  return complianceRepository.exportLoginHistory(filters);
}
