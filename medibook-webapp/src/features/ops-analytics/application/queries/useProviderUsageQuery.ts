import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import type { AnalyticsPeriodCode } from '@/features/ops-analytics/domain/entities/analytics.entities';
import {
  ANALYTICS_STALE_TIME_MS,
  analyticsKeys,
} from '@/features/ops-analytics/application/queries/analytics.keys';
import { fetchProviderUsage } from '@/features/ops-analytics/application/usecases/fetchProviderUsage';

/** `GET /platform/analytics/providers` for the window. `enabled` false → idle (tab not shown). */
export function useProviderUsageQuery(period: AnalyticsPeriodCode, enabled = true) {
  return useQuery({
    queryKey: analyticsKeys.tab('providers', period),
    queryFn: async () => unwrap(await fetchProviderUsage(period)),
    staleTime: ANALYTICS_STALE_TIME_MS,
    enabled,
  });
}
