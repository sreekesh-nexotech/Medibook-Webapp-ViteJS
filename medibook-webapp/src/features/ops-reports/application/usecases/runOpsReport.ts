import type { Result } from '@/core/error/failure';

import type {
  OpsReportResult,
  OpsReportRunQuery,
} from '@/features/ops-reports/domain/entities/opsReports.types';
import { opsReportsRepository } from '@/features/ops-reports/infrastructure/repositories/opsReports.repository.impl';

export function runOpsReport(query: OpsReportRunQuery): Promise<Result<OpsReportResult>> {
  return opsReportsRepository.runReport(query);
}
