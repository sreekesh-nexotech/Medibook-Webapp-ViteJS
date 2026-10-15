import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { opsReportsKeys } from '@/features/ops-reports/application/queries/opsReports.keys';
import { runOpsReport } from '@/features/ops-reports/application/usecases/runOpsReport';
import type { OpsReportRunQuery } from '@/features/ops-reports/domain/entities/opsReports.types';

/** Reports read money and bookings that move all day; a minute is fresh enough for a preview. */
const RUN_STALE_MS = 60_000;

/** Stands in for the query while the hook is idle; never sent (`enabled: false`). */
const IDLE_QUERY: OpsReportRunQuery = { code: '', params: {}, page: 1, pageSize: 1 };

/**
 * One page of a report run (`GET /platform/reports/{code}`). Idle until the
 * user runs it (`query` null), so changing a filter never fires a heavy query
 * by itself; the previous page stays on screen while the next loads.
 */
export function useOpsReportRunQuery(query: OpsReportRunQuery | null) {
  const q = query ?? IDLE_QUERY;
  return useQuery({
    enabled: query !== null,
    queryKey: opsReportsKeys.run(q),
    queryFn: async () => unwrap(await runOpsReport(q)),
    staleTime: RUN_STALE_MS,
    placeholderData: keepPreviousData,
    retry: false,
  });
}
