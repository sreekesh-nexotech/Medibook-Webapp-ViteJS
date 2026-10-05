import type { Result } from '@/core/error/failure';

import type {
  OpsReportExport,
  OpsReportSummary,
} from '@/features/ops-reports/domain/entities/opsReports.types';

/** The platform report catalogue and its exports (`/platform/reports`). */
export interface OpsReportsRepository {
  listReports(): Promise<Result<readonly OpsReportSummary[]>>;
  /** Export report `code` as CSV, unfiltered (the screen has no filters). */
  exportReportCsv(code: string): Promise<Result<OpsReportExport>>;
}
