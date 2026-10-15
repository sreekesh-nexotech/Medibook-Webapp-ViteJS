import type {
  OpsReportRunQuery,
  ReportScheduleListQuery,
} from '@/features/ops-reports/domain/entities/opsReports.types';

/** Query keys for the ops reports screen. */
export const opsReportsKeys = {
  all: ['ops-reports'] as const,
  list: () => [...opsReportsKeys.all, 'list'] as const,
  runs: () => [...opsReportsKeys.all, 'run'] as const,
  run: (query: OpsReportRunQuery) => [...opsReportsKeys.runs(), query] as const,
  exportFile: (exportId: string) => [...opsReportsKeys.all, 'export-file', exportId] as const,
  schedules: () => [...opsReportsKeys.all, 'schedules'] as const,
  scheduleList: (query: ReportScheduleListQuery) => [...opsReportsKeys.schedules(), query] as const,
};
