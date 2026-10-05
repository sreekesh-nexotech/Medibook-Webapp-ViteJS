import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import type { AnalyticsPeriodCode } from '@/features/ops-analytics/domain/entities/analytics.entities';
import {
  ANALYTICS_STALE_TIME_MS,
  analyticsKeys,
} from '@/features/ops-analytics/application/queries/analytics.keys';
import { fetchApiErrors } from '@/features/ops-analytics/application/usecases/fetchApiErrors';

/** `GET /platform/analytics/errors` for the window. `enabled` false → idle (tab not shown). */
export function useApiErrorsQuery(period: AnalyticsPeriodCode, enabled = true) {
  return useQuery({
    queryKey: analyticsKeys.tab('errors', period),
    queryFn: async () => unwrap(await fetchApiErrors(period)),
    staleTime: ANALYTICS_STALE_TIME_MS,
    enabled,
  });
}
