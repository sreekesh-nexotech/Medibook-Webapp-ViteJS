import type { DashboardPeriod } from '@/features/dashboard/domain/entities/dashboard.types';

/**
 * The admin dashboard's period presets — exactly the backend's windows
 * (`today | 7d | 30d | mtd`), so every figure on screen is a real query.
 */
export const PERIOD_OPTIONS = ['Today', 'Last 7 days', 'Last 30 days', 'This month'] as const;

export type Period = (typeof PERIOD_OPTIONS)[number];

/** The `period` query value behind each preset. */
export const PERIOD_CODE: Readonly<Record<Period, DashboardPeriod>> = {
  Today: 'today',
  'Last 7 days': '7d',
  'Last 30 days': '30d',
  'This month': 'mtd',
};

/** Narrow a raw select value back to the closed `Period` set. */
export function isPeriod(value: string): value is Period {
  return (PERIOD_OPTIONS as readonly string[]).includes(value);
}
