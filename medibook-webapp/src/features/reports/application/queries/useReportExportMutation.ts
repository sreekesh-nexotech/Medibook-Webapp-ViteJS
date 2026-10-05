import { useMutation } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import type { ReportExportRequest } from '@/features/reports/domain/entities/reports.entities';
import { exportReport } from '@/features/reports/application/usecases/exportReport';

/**
 * Export the filtered report as a file. A read, so there is nothing to
 * invalidate; it is a mutation because the user triggers it and the result is
 * a one-off file, not cached server state.
 */
export function useReportExportMutation() {
  return useMutation({
    mutationFn: async (request: ReportExportRequest) => unwrap(await exportReport(request)),
  });
}
