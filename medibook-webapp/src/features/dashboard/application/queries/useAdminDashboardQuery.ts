import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import {
  DASHBOARD_REFETCH_INTERVAL_MS,
  dashboardKeys,
} from '@/features/dashboard/application/queries/dashboard.keys';
import { fetchAdminDashboard } from '@/features/dashboard/application/usecases/fetchAdminDashboard';
import type { DashboardPeriod } from '@/features/dashboard/domain/entities/dashboard.types';

/**
 * Hospital overview for one period. The previous period's figures stay on
 * screen while a newly picked one loads, instead of flashing to skeletons.
 */
export function useAdminDashboardQuery(period: DashboardPeriod) {
  return useQuery({
    queryKey: dashboardKeys.admin(period),
    queryFn: async () => unwrap(await fetchAdminDashboard(period)),
    placeholderData: keepPreviousData,
    refetchInterval: DASHBOARD_REFETCH_INTERVAL_MS,
  });
}
