import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import {
  DASHBOARD_REFETCH_INTERVAL_MS,
  dashboardKeys,
} from '@/features/dashboard/application/queries/dashboard.keys';
import { fetchReceptionDashboard } from '@/features/dashboard/application/usecases/fetchReceptionDashboard';

/** Today's front-desk view: doctor sessions, queue counts and what needs action. */
export function useReceptionDashboardQuery(enabled = true) {
  return useQuery({
    enabled,
    queryKey: dashboardKeys.reception(),
    queryFn: async () => unwrap(await fetchReceptionDashboard()),
    refetchInterval: DASHBOARD_REFETCH_INTERVAL_MS,
  });
}
