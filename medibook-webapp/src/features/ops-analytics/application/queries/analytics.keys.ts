import type { AnalyticsPeriodCode } from '@/features/ops-analytics/domain/entities/analytics.entities';

/** Query keys for platform analytics (standards §4 — no inline key arrays). */
export const analyticsKeys = {
  all: ['ops-analytics'] as const,
  tab: (tab: string, period: AnalyticsPeriodCode) => [...analyticsKeys.all, tab, period] as const,
};

/** Rollups refresh nightly; a few minutes of freshness is plenty. */
export const ANALYTICS_STALE_TIME_MS = 5 * 60_000;
