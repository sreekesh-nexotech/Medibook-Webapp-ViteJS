import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { opsReportsKeys } from '@/features/ops-reports/application/queries/opsReports.keys';
import { fetchOpsExportFile } from '@/features/ops-reports/application/usecases/fetchOpsExportFile';

/** How often a queued export is re-checked while the worker builds it. */
export const EXPORT_POLL_INTERVAL_MS = 5_000;

/** Stop polling after this long; the email still arrives when it is ready. */
export const EXPORT_POLL_MAX_MS = 15 * 60_000;

/**
 * A queued export's state (`GET /shared/files/{export_id}`), polled while it
 * is pending and for at most `EXPORT_POLL_MAX_MS` after `startedAt`. Idle
 * while `exportId` is null.
 */
export function useOpsExportFileQuery(exportId: string | null, startedAt: number) {
  return useQuery({
    enabled: exportId !== null,
    queryKey: opsReportsKeys.exportFile(exportId ?? ''),
    queryFn: async () => unwrap(await fetchOpsExportFile(exportId ?? '')),
    refetchInterval: (query) =>
      query.state.data?.status === 'pending' && Date.now() - startedAt < EXPORT_POLL_MAX_MS
        ? EXPORT_POLL_INTERVAL_MS
        : false,
    retry: false,
  });
}
