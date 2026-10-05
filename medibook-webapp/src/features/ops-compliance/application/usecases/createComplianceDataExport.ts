import type { Result } from '@/core/error/failure';

import type {
  DataExportDraft,
  DataRequest,
} from '@/features/ops-compliance/domain/entities/compliance.entities';
import { complianceRepository } from '@/features/ops-compliance/infrastructure/repositories/compliance.repository.impl';

export function createComplianceDataExport(draft: DataExportDraft): Promise<Result<DataRequest>> {
  return complianceRepository.createDataExport(draft);
}
