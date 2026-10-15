import { useQuery } from '@tanstack/react-query';

import { isFailure, unwrap } from '@/core/error/failure';

import { reportsKeys } from '@/features/reports/application/queries/reports.keys';
import { fetchReportExportFile } from '@/features/reports/application/usecases/fetchReportExportFile';

/** How often a queued export is re-checked while it is being built. */
const EXPORT_POLL_MS = 5_000;

const HTTP_NOT_FOUND = 404;

interface ExportFileQueryOptions {
  /**
   * Keep checking while the export is being built. An older backend answers
   * 404 until the file exists, so a just-queued export treats 404 as
   * "not ready yet" too; an emailed link does not (404 there means gone).
   */
  readonly waitForBuild?: boolean;
}

/** A queued or emailed report export (`GET /shared/files/{id}`), re-checked while pending. */
export function useReportExportFileQuery(fileId: string, options: ExportFileQueryOptions = {}) {
  return useQuery({
    queryKey: reportsKeys.exportFile(fileId),
    queryFn: async () => unwrap(await fetchReportExportFile(fileId)),
    enabled: fileId !== '',
    refetchInterval: (query) => {
      if (query.state.data?.status === 'pending') return EXPORT_POLL_MS;
      const error = query.state.error;
      const notYet = isFailure(error) && error.status === HTTP_NOT_FOUND;
      return options.waitForBuild && notYet ? EXPORT_POLL_MS : false;
    },
  });
}
