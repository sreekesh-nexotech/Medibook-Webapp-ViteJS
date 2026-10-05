import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import type { AnalyticsPeriodCode } from '@/features/ops-analytics/domain/entities/analytics.entities';
import {
  ANALYTICS_STALE_TIME_MS,
  analyticsKeys,
} from '@/features/ops-analytics/application/queries/analytics.keys';
import { fetchDepartmentsSplit } from '@/features/ops-analytics/application/usecases/fetchDepartmentsSplit';

/** `GET /platform/analytics/departments-split` for the window. `enabled` false → idle (tab not shown). */
export function useDepartmentsSplitQuery(period: AnalyticsPeriodCode, enabled = true) {
  return useQuery({
    queryKey: analyticsKeys.tab('departments-split', period),
    queryFn: async () => unwrap(await fetchDepartmentsSplit(period)),
    staleTime: ANALYTICS_STALE_TIME_MS,
    enabled,
  });
}
