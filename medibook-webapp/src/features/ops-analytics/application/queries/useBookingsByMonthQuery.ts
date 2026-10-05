import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import type { AnalyticsPeriodCode } from '@/features/ops-analytics/domain/entities/analytics.entities';
import {
  ANALYTICS_STALE_TIME_MS,
  analyticsKeys,
} from '@/features/ops-analytics/application/queries/analytics.keys';
import { fetchBookingsByMonth } from '@/features/ops-analytics/application/usecases/fetchBookingsByMonth';

/** `GET /platform/analytics/bookings-by-month` for the window. `enabled` false → idle (tab not shown). */
export function useBookingsByMonthQuery(period: AnalyticsPeriodCode, enabled = true) {
  return useQuery({
    queryKey: analyticsKeys.tab('bookings-by-month', period),
    queryFn: async () => unwrap(await fetchBookingsByMonth(period)),
    staleTime: ANALYTICS_STALE_TIME_MS,
    enabled,
  });
}
