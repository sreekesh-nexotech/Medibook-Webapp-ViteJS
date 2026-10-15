import { useMutation } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';
import { downloadBlob } from '@/shared/lib/download';

import { exportOpsReport } from '@/features/ops-reports/application/usecases/exportOpsReport';
import type {
  OpsReportFormat,
  OpsReportParams,
} from '@/features/ops-reports/domain/entities/opsReports.types';

interface ExportInput {
  readonly code: string;
  readonly format: OpsReportFormat;
  readonly params: OpsReportParams;
}

/**
 * Export one report with the current filters and, when the server returns
 * the file, hand it to the browser. A large export resolves as `processing`
 * instead: the server builds it in the background (the screen polls it) and
 * emails the requester. Nothing cached changes, so there is nothing to
 * invalidate.
 */
export function useExportOpsReportMutation() {
  return useMutation({
    mutationFn: async ({ code, format, params }: ExportInput) => {
      const result = unwrap(await exportOpsReport(code, format, params));
      if (result.status === 'file') downloadBlob(result.filename, result.blob);
      return result;
    },
  });
}
