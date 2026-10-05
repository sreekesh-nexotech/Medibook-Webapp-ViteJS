import type { DashboardPeriod } from '@/features/dashboard/domain/entities/dashboard.types';

/** Query keys for the hospital dashboards. */
export const dashboardKeys = {
  all: ['dashboard'] as const,
  admin: (period: DashboardPeriod) => [...dashboardKeys.all, 'admin', period] as const,
  reception: () => [...dashboardKeys.all, 'reception'] as const,
};

/**
 * The dashboards are live operational views (queues move, payments land), so
 * they refetch in the background on this interval while a screen is open.
 */
export const DASHBOARD_REFETCH_INTERVAL_MS = 60_000;
