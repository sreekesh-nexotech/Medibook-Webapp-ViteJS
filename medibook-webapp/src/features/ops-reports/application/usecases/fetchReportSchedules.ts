import type { Page } from '@/core/api/pagination';
import type { Result } from '@/core/error/failure';

import type {
  ReportSchedule,
  ReportScheduleListQuery,
} from '@/features/ops-reports/domain/entities/opsReports.types';
import { opsReportsRepository } from '@/features/ops-reports/infrastructure/repositories/opsReports.repository.impl';

export function fetchReportSchedules(
  query: ReportScheduleListQuery,
): Promise<Result<Page<ReportSchedule>>> {
  return opsReportsRepository.listSchedules(query);
}
