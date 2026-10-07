import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';
import { useOpsPermission } from '@/shared/hooks/useOpsPermission';

import { opsReportsKeys } from '@/features/ops-reports/application/queries/opsReports.keys';
import { fetchReportSchedules } from '@/features/ops-reports/application/usecases/fetchReportSchedules';
import type { ReportScheduleListQuery } from '@/features/ops-reports/domain/entities/opsReports.types';

const SCHEDULES_STALE_MS = 30_000;

/** One page of report schedules; the read itself needs `reports.edit` (backend rule). */
export function useReportSchedulesQuery(query: ReportScheduleListQuery) {
  const canRead = useOpsPermission().can('reports.edit');
  return useQuery({
    enabled: canRead,
    queryKey: opsReportsKeys.scheduleList(query),
    queryFn: async () => unwrap(await fetchReportSchedules(query)),
    staleTime: SCHEDULES_STALE_MS,
    placeholderData: keepPreviousData,
  });
}
