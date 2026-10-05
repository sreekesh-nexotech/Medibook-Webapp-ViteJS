import type { Result } from '@/core/error/failure';

import type {
  ReportDefinition,
  ReportExport,
  ReportExportRequest,
  ReportQuery,
  ReportResult,
} from '@/features/reports/domain/entities/reports.entities';

/** Hospital reports (`/hospital/reports`, permission `reports.view`). */
export interface ReportsRepository {
  /** The report catalogue: every report with its filters and columns. */
  listReports(): Promise<Result<readonly ReportDefinition[]>>;
  /** One page of a report with its KPIs. */
  getReport(query: ReportQuery): Promise<Result<ReportResult>>;
  /** The whole filtered report as a file, or a queued export for very large ones. */
  exportReport(request: ReportExportRequest): Promise<Result<ReportExport>>;
}
