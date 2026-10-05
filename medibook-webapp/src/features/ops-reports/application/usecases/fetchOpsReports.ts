import type { Result } from '@/core/error/failure';

import type { OpsReportSummary } from '@/features/ops-reports/domain/entities/opsReports.types';
import { opsReportsRepository } from '@/features/ops-reports/infrastructure/repositories/opsReports.repository.impl';

export function fetchOpsReports(): Promise<Result<readonly OpsReportSummary[]>> {
  return opsReportsRepository.listReports();
}
