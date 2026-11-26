import type { Result } from '@/core/error/failure';

import type {
  ReportSchedule,
  ReportScheduleUpdate,
} from '@/features/reports/domain/entities/reports.entities';
import { reportsRepository } from '@/features/reports/infrastructure/repositories/reports.repository.impl';

export function updateReportSchedule(
  id: string,
  changes: ReportScheduleUpdate,
  version: number,
): Promise<Result<ReportSchedule>> {
  return reportsRepository.updateSchedule(id, changes, version);
}
