import { create } from 'zustand';

import { DEFAULT_ANALYTICS_PERIOD } from './analytics.fixtures';
import type { AnalyticsPeriod, AnalyticsTab } from './analytics.types';

/**
 * Usage-analytics UI state — the selected reporting window and section.
 *
 * Client state only, per the standards' Query/Zustand split: the figures
 * themselves are derived from the seeds by `analytics.derive.ts`, never
 * copied into here. It lives in a store rather than `useState` so the period
 * survives navigating to a hospital and back, and so the screen and its cards
 * read one source of truth (audit 2.5: a period control that changes nothing
 * is the same defect as a filter that changes nothing).
 */

interface AnalyticsState {
  period: AnalyticsPeriod;
  tab: AnalyticsTab;
}

interface AnalyticsActions {
  setPeriod: (period: AnalyticsPeriod) => void;
  setTab: (tab: AnalyticsTab) => void;
}

export const useAnalyticsStore = create<AnalyticsState & AnalyticsActions>()((set) => ({
  period: DEFAULT_ANALYTICS_PERIOD,
  tab: 'Bookings',
  setPeriod: (period) => set({ period }),
  setTab: (tab) => set({ tab }),
}));
