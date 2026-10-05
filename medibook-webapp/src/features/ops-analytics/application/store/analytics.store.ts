import { create } from 'zustand';

import type { AnalyticsPeriod, AnalyticsTab } from './analytics.types';

/** The reporting windows the period select offers. */
export const ANALYTICS_PERIODS: readonly AnalyticsPeriod[] = [
  'Last 7 days',
  'Last 30 days',
  'Last 90 days',
  'Last 12 months',
];

/** The window the screen opens on. */
const DEFAULT_ANALYTICS_PERIOD: AnalyticsPeriod = 'Last 30 days';

/**
 * Usage-analytics UI state — the selected reporting window and section.
 *
 * Client state only, per the standards' Query/Zustand split: the figures
 * themselves come from the analytics query hooks, never copied into here. It lives in a store rather than `useState` so the period
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
