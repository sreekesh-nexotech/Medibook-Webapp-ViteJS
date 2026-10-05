import type { Result } from '@/core/error/failure';

import type {
  ReportQuery,
  ReportResult,
} from '@/features/reports/domain/entities/reports.entities';
import { reportsRepository } from '@/features/reports/infrastructure/repositories/reports.repository.impl';

export function fetchReport(query: ReportQuery): Promise<Result<ReportResult>> {
  return reportsRepository.getReport(query);
}
