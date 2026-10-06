import type { Result } from '@/core/error/failure';

import type { ReportExportFile } from '@/features/reports/domain/entities/reports.entities';
import { reportsRepository } from '@/features/reports/infrastructure/repositories/reports.repository.impl';

export function fetchReportExportFile(fileId: string): Promise<Result<ReportExportFile>> {
  return reportsRepository.getExportFile(fileId);
}
