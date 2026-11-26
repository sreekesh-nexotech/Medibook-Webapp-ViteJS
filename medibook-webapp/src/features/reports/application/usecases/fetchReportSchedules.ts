import type { Result } from '@/core/error/failure';

import type { ReportSchedule } from '@/features/reports/domain/entities/reports.entities';
import { reportsRepository } from '@/features/reports/infrastructure/repositories/reports.repository.impl';

export function fetchReportSchedules(): Promise<Result<readonly ReportSchedule[]>> {
  return reportsRepository.listSchedules();
}
