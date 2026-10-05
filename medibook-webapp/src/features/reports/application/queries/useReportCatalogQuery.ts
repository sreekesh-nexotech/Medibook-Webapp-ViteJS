import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { reportsKeys } from '@/features/reports/application/queries/reports.keys';
import { fetchReportCatalog } from '@/features/reports/application/usecases/fetchReportCatalog';

/** The catalogue is static per deployment; refetching it often buys nothing. */
const CATALOG_STALE_TIME_MS = 10 * 60_000;

/** Every report with its filters and columns. `enabled` false → idle (no permission). */
export function useReportCatalogQuery(enabled = true) {
  return useQuery({
    queryKey: reportsKeys.catalog(),
    queryFn: async () => unwrap(await fetchReportCatalog()),
    staleTime: CATALOG_STALE_TIME_MS,
    enabled,
  });
}
