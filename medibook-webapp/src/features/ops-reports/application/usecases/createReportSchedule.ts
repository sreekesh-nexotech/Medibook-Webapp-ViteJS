import type { Result } from '@/core/error/failure';

import type {
  ReportSchedule,
  ReportScheduleDraft,
} from '@/features/ops-reports/domain/entities/opsReports.types';
import { opsReportsRepository } from '@/features/ops-reports/infrastructure/repositories/opsReports.repository.impl';

export function createReportSchedule(draft: ReportScheduleDraft): Promise<Result<ReportSchedule>> {
  return opsReportsRepository.createSchedule(draft);
}
