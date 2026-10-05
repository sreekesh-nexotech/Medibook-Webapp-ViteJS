import type { Result } from '@/core/error/failure';

import type { ReportDefinition } from '@/features/reports/domain/entities/reports.entities';
import { reportsRepository } from '@/features/reports/infrastructure/repositories/reports.repository.impl';

export function fetchReportCatalog(): Promise<Result<readonly ReportDefinition[]>> {
  return reportsRepository.listReports();
}
