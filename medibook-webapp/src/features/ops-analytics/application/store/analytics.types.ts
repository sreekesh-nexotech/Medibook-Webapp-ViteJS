/**
 * Usage-analytics view-model types (interim entities for the static-seed
 * phase). Audit 2.5 / SA-05: the analytics screen's numbers used to be fixed
 * literals in the JSX, the period control changed nothing, and provider usage
 * and error rates had no screen at all. Everything below is derived from the
 * seeds in `analytics.fixtures.ts` for the **selected period**, so changing
 * the period genuinely changes every figure on the screen.
 */
import type { IconName } from '@/shared/ui/icon-registry';

/** The four windows the analytics screen reports on. */
export type AnalyticsPeriod = 'Last 7 days' | 'Last 30 days' | 'Last 90 days' | 'Last 12 months';

/** Which section of the analytics screen is showing. */
export type AnalyticsTab = 'Bookings' | 'Providers' | 'Error Rates';

/** One point of a derived series (a day, a week or a month of the window). */
export interface SeriesPoint {
  /** Axis label — "Mon", "W3", "Apr". */
  readonly label: string;
  readonly value: number;
}

/** One bucket of a period's booking series, as seeded. */
export interface PeriodBucket {
  readonly label: string;
  /** Calendar days this bucket covers — what every per-day figure divides by. */
  readonly days: number;
  readonly bookings: number;
}

/** Headline booking figures for the selected period. */
export interface BookingTotals {
  readonly bookings: number;
  readonly days: number;
  readonly avgDaily: number;
  readonly successPct: number;
  readonly cancelPct: number;
  readonly noShowPct: number;
  /** Change vs the previous window of the same length, in percent. */
  readonly bookingsDeltaPct: number;
  readonly avgDailyDeltaPct: number;
  readonly cancelDeltaPct: number;
}

/** One department's share of the selected period's bookings. */
export interface DeptShare {
  readonly dept: string;
  readonly pct: number;
  readonly bookings: number;
}

/** One hospital's bookings in the selected period. */
export interface HospitalUsage {
  /** Tenant id — names resolve through the live registry, never a copy. */
  readonly hid: number;
  readonly bookings: number;
  readonly pct: number;
}

/** How a measured figure compares with its alert threshold. */
export type UsageHealth = 'healthy' | 'warning' | 'critical';

/** One third-party provider's consumption in the selected period. */
export interface ProviderUsage {
  readonly id: string;
  /** Display name including the vendor, e.g. "SMS · Gupshup". */
  readonly name: string;
  readonly channel: string;
  readonly icon: IconName;
  /** What one unit is: messages, emails, transactions… */
  readonly unit: string;
  readonly used: number;
  /** Units included in the plan for this window. */
  readonly allowance: number;
  /** Units left in the plan (0 once the allowance is spent). */
  readonly creditsLeft: number;
  /** Units consumed beyond the allowance (0 while inside it). */
  readonly overage: number;
  readonly usagePct: number;
  /** Spend in paise — the money unit everything is stored in. */
  readonly costPaise: number;
  readonly health: UsageHealth;
  /** Segment colour for the spend donut (a design token, never raw hex). */
  readonly color: string;
}

/** Whether an error row is a provider integration or one of our own surfaces. */
export type ErrorScope = 'Provider' | 'API';

/** One provider or API surface's error and latency figures for the period. */
export interface ErrorRateRow {
  readonly id: string;
  readonly scope: ErrorScope;
  readonly name: string;
  readonly requests: number;
  readonly errors: number;
  readonly errorPct: number;
  readonly p95Ms: number;
  /** Error percentage per bucket of the window. */
  readonly trend: readonly SeriesPoint[];
  readonly health: UsageHealth;
}

/** Everything the analytics screen shows for one period. */
export interface AnalyticsSnapshot {
  readonly period: AnalyticsPeriod;
  readonly buckets: readonly PeriodBucket[];
  readonly series: readonly SeriesPoint[];
  readonly totals: BookingTotals;
  readonly depts: readonly DeptShare[];
  readonly hospitals: readonly HospitalUsage[];
  readonly providers: readonly ProviderUsage[];
  readonly errors: readonly ErrorRateRow[];
}
