import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { reportsKeys } from '@/features/reports/application/queries/reports.keys';
import { fetchReportSchedules } from '@/features/reports/application/usecases/fetchReportSchedules';

/** This hospital's scheduled report emails. */
export function useReportSchedulesQuery(enabled = true) {
  return useQuery({
    queryKey: reportsKeys.schedules(),
    queryFn: async () => unwrap(await fetchReportSchedules()),
    enabled,
  });
}
