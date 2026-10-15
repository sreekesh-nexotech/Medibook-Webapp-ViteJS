import type { Page } from '@/core/api/pagination';
import type { Result } from '@/core/error/failure';

import type {
  OpsExportFileState,
  OpsReportExport,
  OpsReportFormat,
  OpsReportParams,
  OpsReportResult,
  OpsReportRunQuery,
  OpsReportSummary,
  ReportSchedule,
  ReportScheduleChanges,
  ReportScheduleDraft,
  ReportScheduleListQuery,
} from '@/features/ops-reports/domain/entities/opsReports.types';

/** The platform report catalogue, runs, exports and schedules (`/platform/report*`). */
export interface OpsReportsRepository {
  listReports(): Promise<Result<readonly OpsReportSummary[]>>;
  /** One page of a report with the given filters. */
  runReport(query: OpsReportRunQuery): Promise<Result<OpsReportResult>>;
  /** Export report `code` in `fmt` with the given filters. */
  exportReport(
    code: string,
    fmt: OpsReportFormat,
    params: OpsReportParams,
  ): Promise<Result<OpsReportExport>>;
  /** Where a queued export stands. */
  getExportFile(exportId: string): Promise<Result<OpsExportFileState>>;
  listSchedules(query: ReportScheduleListQuery): Promise<Result<Page<ReportSchedule>>>;
  createSchedule(draft: ReportScheduleDraft): Promise<Result<ReportSchedule>>;
  updateSchedule(
    id: string,
    changes: ReportScheduleChanges,
    version: number | null,
  ): Promise<Result<ReportSchedule>>;
}
