import type { Result } from '@/core/error/failure';

import type {
  ReportSchedule,
  ReportScheduleChanges,
} from '@/features/ops-reports/domain/entities/opsReports.types';
import { opsReportsRepository } from '@/features/ops-reports/infrastructure/repositories/opsReports.repository.impl';

export function updateReportSchedule(
  id: string,
  changes: ReportScheduleChanges,
  version: number | null,
): Promise<Result<ReportSchedule>> {
  return opsReportsRepository.updateSchedule(id, changes, version);
}
