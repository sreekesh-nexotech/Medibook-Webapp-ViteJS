import type { Result } from '@/core/error/failure';

import type { OpsReportExport } from '@/features/ops-reports/domain/entities/opsReports.types';
import { opsReportsRepository } from '@/features/ops-reports/infrastructure/repositories/opsReports.repository.impl';

export function exportOpsReport(code: string): Promise<Result<OpsReportExport>> {
  return opsReportsRepository.exportReportCsv(code);
}
