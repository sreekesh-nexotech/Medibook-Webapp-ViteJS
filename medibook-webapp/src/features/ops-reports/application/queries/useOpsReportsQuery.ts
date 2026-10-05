import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { opsReportsKeys } from '@/features/ops-reports/application/queries/opsReports.keys';
import { fetchOpsReports } from '@/features/ops-reports/application/usecases/fetchOpsReports';

/** The catalogue is code-defined on the server and changes only with a deploy. */
const OPS_REPORTS_STALE_MS = 30 * 60_000;

/** Every registered platform report (`GET /platform/reports`). */
export function useOpsReportsQuery() {
  return useQuery({
    queryKey: opsReportsKeys.list(),
    queryFn: async () => unwrap(await fetchOpsReports()),
    staleTime: OPS_REPORTS_STALE_MS,
  });
}
