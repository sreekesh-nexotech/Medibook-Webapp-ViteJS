import type { Result } from '@/core/error/failure';

import type { OpsExportFileState } from '@/features/ops-reports/domain/entities/opsReports.types';
import { opsReportsRepository } from '@/features/ops-reports/infrastructure/repositories/opsReports.repository.impl';

export function fetchOpsExportFile(exportId: string): Promise<Result<OpsExportFileState>> {
  return opsReportsRepository.getExportFile(exportId);
}
