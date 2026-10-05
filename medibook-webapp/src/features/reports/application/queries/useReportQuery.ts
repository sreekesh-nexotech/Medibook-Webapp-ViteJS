import { keepPreviousData, skipToken, useQuery } from '@tanstack/react-query';

import { QUERY_STALE_TIME_MS } from '@/core/config/api';
import { unwrap } from '@/core/error/failure';

import type { ReportQuery } from '@/features/reports/domain/entities/reports.entities';
import { reportsKeys } from '@/features/reports/application/queries/reports.keys';
import { fetchReport } from '@/features/reports/application/usecases/fetchReport';

/**
 * One page of a report. `null` → idle (e.g. while a date range is invalid).
 * While the next page or filter loads, the previous page stays on screen
 * (`isPlaceholderData`).
 */
export function useReportQuery(query: ReportQuery | null) {
  return useQuery({
    queryKey: query ? reportsKeys.result(query) : reportsKeys.results(),
    queryFn: query ? async () => unwrap(await fetchReport(query)) : skipToken,
    staleTime: QUERY_STALE_TIME_MS,
    placeholderData: keepPreviousData,
  });
}
