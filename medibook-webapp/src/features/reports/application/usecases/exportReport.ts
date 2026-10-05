import type { Result } from '@/core/error/failure';

import type {
  ReportExport,
  ReportExportRequest,
} from '@/features/reports/domain/entities/reports.entities';
import { reportsRepository } from '@/features/reports/infrastructure/repositories/reports.repository.impl';

export function exportReport(request: ReportExportRequest): Promise<Result<ReportExport>> {
  return reportsRepository.exportReport(request);
}
