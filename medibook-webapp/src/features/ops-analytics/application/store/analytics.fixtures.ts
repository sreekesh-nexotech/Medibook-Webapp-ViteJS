/**
 * Seeds for usage analytics — the only literals in the feature. Everything
 * the screen shows is derived from these for the selected period
 * (`analytics.derive.ts`), which is what makes the period control real
 * (audit 2.5 / SA-05).
 *
 * Cross-screen coherence:
 *  - the `Last 7 days` buckets are the same daily totals the ops dashboard's
 *    "Booking Usage" card plots, so the two screens cannot disagree;
 *  - `Last 30 days` sums to 48,240 bookings — the figure the design's
 *    analytics KPI showed as a literal, now the default period's derived total;
 *  - departments use the seven canonical department names, and hospitals are
 *    referenced by tenant id so names resolve through the live registry.
 */
import type { AnalyticsPeriod, PeriodBucket } from './analytics.types';

import type { IconName } from '@/shared/ui/icon-registry';

export const ANALYTICS_PERIODS: readonly AnalyticsPeriod[] = [
  'Last 7 days',
  'Last 30 days',
  'Last 90 days',
  'Last 12 months',
];

/** The window the screen opens on. */
export const DEFAULT_ANALYTICS_PERIOD: AnalyticsPeriod = 'Last 30 days';

/** Booking buckets per period — label, calendar days covered, bookings. */
export const PERIOD_SERIES: Readonly<Record<AnalyticsPeriod, readonly PeriodBucket[]>> = {
  'Last 7 days': [
    { label: 'Mon', days: 1, bookings: 1240 },
    { label: 'Tue', days: 1, bookings: 1420 },
    { label: 'Wed', days: 1, bookings: 1180 },
    { label: 'Thu', days: 1, bookings: 1660 },
    { label: 'Fri', days: 1, bookings: 1842 },
    { label: 'Sat', days: 1, bookings: 980 },
    { label: 'Sun', days: 1, bookings: 760 },
  ],
  'Last 30 days': [
    { label: 'W1', days: 6, bookings: 8420 },
    { label: 'W2', days: 6, bookings: 9110 },
    { label: 'W3', days: 6, bookings: 9640 },
    { label: 'W4', days: 6, bookings: 10180 },
    { label: 'W5', days: 6, bookings: 10890 },
  ],
  'Last 90 days': [
    { label: 'Mar', days: 16, bookings: 24180 },
    { label: 'Apr', days: 30, bookings: 45900 },
    { label: 'May', days: 31, bookings: 47860 },
    { label: 'Jun', days: 13, bookings: 21060 },
  ],
  'Last 12 months': [
    { label: 'Jul', days: 31, bookings: 34100 },
    { label: 'Aug', days: 31, bookings: 37400 },
    { label: 'Sep', days: 30, bookings: 41800 },
    { label: 'Oct', days: 31, bookings: 43300 },
    { label: 'Nov', days: 30, bookings: 44200 },
    { label: 'Dec', days: 31, bookings: 46700 },
    { label: 'Jan', days: 31, bookings: 44900 },
    { label: 'Feb', days: 28, bookings: 42500 },
    { label: 'Mar', days: 31, bookings: 47300 },
    { label: 'Apr', days: 30, bookings: 48900 },
    { label: 'May', days: 31, bookings: 50600 },
    { label: 'Jun', days: 13, bookings: 21100 },
  ],
};

/** Outcome rates and period-on-period movement per window. */
export interface PeriodRates {
  readonly successPct: number;
  readonly cancelPct: number;
  readonly noShowPct: number;
  readonly bookingsDeltaPct: number;
  readonly avgDailyDeltaPct: number;
  /** Movement of the cancellation rate — negative is an improvement. */
  readonly cancelDeltaPct: number;
}

export const PERIOD_RATES: Readonly<Record<AnalyticsPeriod, PeriodRates>> = {
  'Last 7 days': {
    successPct: 94.2,
    cancelPct: 3.1,
    noShowPct: 2.7,
    bookingsDeltaPct: 8.2,
    avgDailyDeltaPct: 4.6,
    cancelDeltaPct: -2.1,
  },
  'Last 30 days': {
    successPct: 93.4,
    cancelPct: 3.6,
    noShowPct: 3,
    bookingsDeltaPct: 11.4,
    avgDailyDeltaPct: 6.2,
    cancelDeltaPct: -0.8,
  },
  'Last 90 days': {
    successPct: 92.1,
    cancelPct: 4.2,
    noShowPct: 3.7,
    bookingsDeltaPct: 18.6,
    avgDailyDeltaPct: 9.1,
    cancelDeltaPct: 0.4,
  },
  'Last 12 months': {
    successPct: 91.3,
    cancelPct: 4.8,
    noShowPct: 3.9,
    bookingsDeltaPct: 42.7,
    avgDailyDeltaPct: 21.5,
    cancelDeltaPct: 1.2,
  },
};

/**
 * Department mix. `base` is the share in the shortest window; `drift` is the
 * percentage-point move per step to a longer window, so the split visibly
 * changes with the period instead of being one frozen list. Shares are
 * normalised to 100 after drifting.
 */
export interface DeptShareSeed {
  readonly dept: string;
  readonly base: number;
  readonly drift: number;
}

export const DEPT_SHARE_SEEDS: readonly DeptShareSeed[] = [
  { dept: 'Cardiology', base: 24, drift: -0.9 },
  { dept: 'General Medicine', base: 19, drift: 1.2 },
  { dept: 'Orthopedics', base: 16, drift: 0.4 },
  { dept: 'Pediatrics', base: 12, drift: 0.6 },
  { dept: 'Neurology', base: 9, drift: -0.3 },
  { dept: 'ENT', base: 7, drift: 0.2 },
  { dept: 'Dermatology', base: 13, drift: -1.2 },
];

/**
 * Usage leaderboard — tenant ids into the ops hospital registry with their
 * share of platform bookings. Ids, never names: `hospName(hid)` resolves the
 * display name so the leaderboard cannot drift from the registry.
 */
export interface HospitalUsageSeed {
  readonly hid: number;
  readonly share: number;
  readonly drift: number;
}

export const HOSPITAL_USAGE_SEEDS: readonly HospitalUsageSeed[] = [
  { hid: 6, share: 15.5, drift: -0.4 },
  { hid: 2, share: 12.7, drift: 0.5 },
  { hid: 8, share: 10.8, drift: 0.2 },
  { hid: 12, share: 10.1, drift: 0.6 },
  { hid: 1, share: 8.9, drift: -0.2 },
  { hid: 13, share: 6.5, drift: 0.3 },
];

/** One third-party provider's consumption and plan terms. */
export interface ProviderSeed {
  readonly id: string;
  readonly name: string;
  readonly channel: string;
  readonly icon: IconName;
  readonly unit: string;
  /** Units consumed per day across the platform. */
  readonly dailyUnits: number;
  /** Units included in the plan per 30 days. */
  readonly monthlyAllowance: number;
  /** Price per unit in paise (money is always an integer in minor units). */
  readonly unitCostPaise: number;
  /** Donut segment colour — a design token, resolved at render. */
  readonly color: string;
}

export const PROVIDER_SEEDS: readonly ProviderSeed[] = [
  {
    id: 'sms',
    name: 'SMS · Gupshup',
    channel: 'SMS',
    icon: 'message-circle',
    unit: 'messages',
    dailyUnits: 4400,
    monthlyAllowance: 150000,
    unitCostPaise: 18,
    color: 'var(--color-blue)',
  },
  {
    id: 'email',
    name: 'Email · Amazon SES',
    channel: 'Email',
    icon: 'mail',
    unit: 'emails',
    dailyUnits: 6800,
    monthlyAllowance: 250000,
    unitCostPaise: 4,
    color: 'var(--color-p-500)',
  },
  {
    id: 'push',
    name: 'Push · Firebase Cloud Messaging',
    channel: 'Push',
    icon: 'bell-ring',
    unit: 'notifications',
    dailyUnits: 24500,
    monthlyAllowance: 900000,
    unitCostPaise: 1,
    color: 'var(--color-g-600)',
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp · Meta Cloud API',
    channel: 'WhatsApp',
    icon: 'smartphone',
    unit: 'messages',
    dailyUnits: 1900,
    monthlyAllowance: 45000,
    unitCostPaise: 72,
    color: 'var(--color-y-600)',
  },
  {
    id: 'payments',
    name: 'Payments · Razorpay',
    channel: 'Payment gateway',
    icon: 'credit-card',
    unit: 'transactions',
    dailyUnits: 1450,
    monthlyAllowance: 60000,
    unitCostPaise: 195,
    color: 'var(--color-orange)',
  },
  {
    id: 'storage',
    name: 'Storage · S3 (reports & media)',
    channel: 'Storage',
    icon: 'layers',
    unit: 'GB transferred',
    dailyUnits: 42,
    monthlyAllowance: 1500,
    unitCostPaise: 260,
    color: 'var(--color-d-500)',
  },
];

/** Days of plan allowance one "monthly" allowance covers. */
export const ALLOWANCE_DAYS = 30;

/** Share of the plan allowance at which a provider is flagged. */
export const USAGE_WARNING_PCT = 85;
export const USAGE_CRITICAL_PCT = 100;

/** One provider integration or API surface, as measured. */
export interface ErrorRateSeed {
  readonly id: string;
  readonly scope: 'Provider' | 'API';
  readonly name: string;
  /** Requests per day across the platform. */
  readonly dailyRequests: number;
  /** Baseline error percentage the trend oscillates around. */
  readonly baseErrorPct: number;
  /** Baseline 95th-percentile latency in ms. */
  readonly baseP95Ms: number;
}

export const ERROR_RATE_SEEDS: readonly ErrorRateSeed[] = [
  {
    id: 'e-sms',
    scope: 'Provider',
    name: 'SMS · Gupshup',
    dailyRequests: 4400,
    baseErrorPct: 0.62,
    baseP95Ms: 410,
  },
  {
    id: 'e-email',
    scope: 'Provider',
    name: 'Email · Amazon SES',
    dailyRequests: 6800,
    baseErrorPct: 0.18,
    baseP95Ms: 280,
  },
  {
    id: 'e-push',
    scope: 'Provider',
    name: 'Push · Firebase Cloud Messaging',
    dailyRequests: 24500,
    baseErrorPct: 0.44,
    baseP95Ms: 190,
  },
  {
    id: 'e-whatsapp',
    scope: 'Provider',
    name: 'WhatsApp · Meta Cloud API',
    dailyRequests: 1900,
    baseErrorPct: 2.35,
    baseP95Ms: 940,
  },
  {
    id: 'e-payments',
    scope: 'Provider',
    name: 'Payments · Razorpay',
    dailyRequests: 1450,
    baseErrorPct: 1.28,
    baseP95Ms: 1180,
  },
  {
    id: 'e-storage',
    scope: 'Provider',
    name: 'Storage · S3 (reports & media)',
    dailyRequests: 3100,
    baseErrorPct: 0.09,
    baseP95Ms: 320,
  },
  {
    id: 'a-booking',
    scope: 'API',
    name: 'Booking API',
    dailyRequests: 38200,
    baseErrorPct: 0.31,
    baseP95Ms: 420,
  },
  {
    id: 'a-payments',
    scope: 'API',
    name: 'Payments API',
    dailyRequests: 12400,
    baseErrorPct: 0.87,
    baseP95Ms: 760,
  },
  {
    id: 'a-auth',
    scope: 'API',
    name: 'Auth & OTP API',
    dailyRequests: 21900,
    baseErrorPct: 1.42,
    baseP95Ms: 350,
  },
  {
    id: 'a-sync',
    scope: 'API',
    name: 'Patient app sync',
    dailyRequests: 64800,
    baseErrorPct: 0.22,
    baseP95Ms: 240,
  },
  {
    id: 'a-console',
    scope: 'API',
    name: 'Hospital console API',
    dailyRequests: 28600,
    baseErrorPct: 0.17,
    baseP95Ms: 310,
  },
  {
    id: 'a-webhooks',
    scope: 'API',
    name: 'Outbound webhooks',
    dailyRequests: 9200,
    baseErrorPct: 3.14,
    baseP95Ms: 1640,
  },
];

/**
 * Deterministic oscillation applied to each bucket of a trend, offset by the
 * row index so no two rows move in lockstep. A fixed wave rather than a random
 * one: the same period must always produce the same numbers.
 */
export const TREND_WAVE: readonly number[] = [0.82, 1.14, 0.91, 1.28, 1.02, 0.76, 1.21, 0.95];

/** Error-rate alert thresholds, in percent. */
export const ERROR_PCT_WARNING = 1;
export const ERROR_PCT_CRITICAL = 2.5;

/** p95 latency alert thresholds, in ms. */
export const P95_WARNING_MS = 800;
export const P95_CRITICAL_MS = 1500;
