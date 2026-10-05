import type { Result } from '@/core/error/failure';

import type {
  ComplianceExportRows,
  ConfigChangeFilters,
  ConfigChangeRecord,
} from '@/features/ops-compliance/domain/entities/compliance.entities';
import { complianceRepository } from '@/features/ops-compliance/infrastructure/repositories/compliance.repository.impl';

export function exportComplianceConfigChanges(
  filters: ConfigChangeFilters,
): Promise<Result<ComplianceExportRows<ConfigChangeRecord>>> {
  return complianceRepository.exportConfigChanges(filters);
}
