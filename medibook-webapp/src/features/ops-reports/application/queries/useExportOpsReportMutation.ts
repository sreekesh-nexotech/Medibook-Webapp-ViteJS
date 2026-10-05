import { useMutation } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';
import { downloadTextFile } from '@/shared/lib/download';

import { exportOpsReport } from '@/features/ops-reports/application/usecases/exportOpsReport';

const CSV_MIME = 'text/csv;charset=utf-8';

/**
 * Export one report as CSV and, when the server returns the file, hand it to
 * the browser. A large export resolves as `processing` instead: the server
 * builds it in the background and emails the requester. Nothing cached
 * changes, so there is nothing to invalidate.
 */
export function useExportOpsReportMutation() {
  return useMutation({
    mutationFn: async (code: string) => {
      const result = unwrap(await exportOpsReport(code));
      if (result.status === 'file') downloadTextFile(result.filename, result.content, CSV_MIME);
      return result;
    },
  });
}
