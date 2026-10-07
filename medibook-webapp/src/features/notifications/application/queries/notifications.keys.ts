import { dashboardKeys } from '@/features/dashboard/application/queries/dashboard.keys';

/**
 * Query keys for the hospital bell. Nested under the dashboard keys on
 * purpose: every `ws/hospital/alerts` push invalidates `dashboardKeys.all`
 * (`useDashboardAlertsLive`), which then refreshes the bell too.
 */
export const notificationsKeys = {
  all: [...dashboardKeys.all, 'notifications'] as const,
  feed: () => [...notificationsKeys.all, 'feed'] as const,
};

/** The bell is a live view; it refetches in the background this often. */
export const NOTIFICATIONS_REFETCH_INTERVAL_MS = 60_000;
