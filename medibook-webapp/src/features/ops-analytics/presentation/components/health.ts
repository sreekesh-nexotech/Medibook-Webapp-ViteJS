import type { UsageHealth } from '@/features/ops-analytics/application/store/analytics.types';

/**
 * Health → the shared status token the `Badge` palette already defines, so a
 * flagged provider or API surface is tinted exactly like every other red /
 * amber / green state in the product (audit 2.5: "flag anything above a
 * threshold with the existing status tokens").
 */
export const HEALTH_STATUS: Readonly<Record<UsageHealth, string>> = {
  healthy: 'Completed',
  warning: 'Warning',
  critical: 'Critical',
};

/** Bar fill per health level, for the allowance meters. */
export const HEALTH_BAR: Readonly<Record<UsageHealth, string>> = {
  healthy: 'bg-g-600',
  warning: 'bg-y-600',
  critical: 'bg-d-500',
};
