import type { ReportQuery } from '@/features/reports/domain/entities/reports.entities';

/** Query keys for hospital reports (standards §4 — no inline key arrays). */
export const reportsKeys = {
  all: ['reports'] as const,
  catalog: () => [...reportsKeys.all, 'catalog'] as const,
  results: () => [...reportsKeys.all, 'result'] as const,
  result: (query: ReportQuery) => [...reportsKeys.results(), query] as const,
  exportFile: (fileId: string) => [...reportsKeys.all, 'export-file', fileId] as const,
};
