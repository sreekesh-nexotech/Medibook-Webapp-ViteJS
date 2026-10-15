import type { Result } from '@/core/error/failure';

import type {
  OpsReportExport,
  OpsReportFormat,
  OpsReportParams,
} from '@/features/ops-reports/domain/entities/opsReports.types';
import { opsReportsRepository } from '@/features/ops-reports/infrastructure/repositories/opsReports.repository.impl';

export function exportOpsReport(
  code: string,
  fmt: OpsReportFormat,
  params: OpsReportParams,
): Promise<Result<OpsReportExport>> {
  return opsReportsRepository.exportReport(code, fmt, params);
}
