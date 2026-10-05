import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import type { AnalyticsPeriodCode } from '@/features/ops-analytics/domain/entities/analytics.entities';
import {
  ANALYTICS_STALE_TIME_MS,
  analyticsKeys,
} from '@/features/ops-analytics/application/queries/analytics.keys';
import { fetchTopHospitals } from '@/features/ops-analytics/application/usecases/fetchTopHospitals';

/** `GET /platform/analytics/top-hospitals` for the window. `enabled` false → idle (tab not shown). */
export function useTopHospitalsQuery(period: AnalyticsPeriodCode, enabled = true) {
  return useQuery({
    queryKey: analyticsKeys.tab('top-hospitals', period),
    queryFn: async () => unwrap(await fetchTopHospitals(period)),
    staleTime: ANALYTICS_STALE_TIME_MS,
    enabled,
  });
}
