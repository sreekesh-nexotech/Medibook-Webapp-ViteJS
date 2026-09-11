/**
 * Pure derivation of every analytics figure from the seeds, for one period.
 *
 * Audit 2.5 / SA-05: "usage numbers are fixed sample values" and the period
 * control changed nothing. The screen now renders only what these functions
 * return, so the period select is the single input that moves bookings, the
 * department mix, the hospital leaderboard, provider consumption, spend, error
 * rates and latency together.
 *
 * No React, no stores — safe to call from render.
 */
import {
  ALLOWANCE_DAYS,
  ANALYTICS_PERIODS,
  DEPT_SHARE_SEEDS,
  ERROR_PCT_CRITICAL,
  ERROR_PCT_WARNING,
  ERROR_RATE_SEEDS,
  HOSPITAL_USAGE_SEEDS,
  P95_CRITICAL_MS,
  P95_WARNING_MS,
  PERIOD_RATES,
  PERIOD_SERIES,
  PROVIDER_SEEDS,
  TREND_WAVE,
  USAGE_CRITICAL_PCT,
  USAGE_WARNING_PCT,
} from './analytics.fixtures';
import type {
  AnalyticsPeriod,
  AnalyticsSnapshot,
  BookingTotals,
  DeptShare,
  ErrorRateRow,
  HospitalUsage,
  PeriodBucket,
  ProviderUsage,
  SeriesPoint,
  UsageHealth,
} from './analytics.types';

/** Money is stored in paise everywhere; display divides by this. */
const PAISE_PER_RUPEE = 100;

/** Percent, to one decimal. */
function pct1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Percent, to two decimals — error rates are small numbers. */
function pct2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** How far along the period list this window is: 0 (shortest) … 3 (longest). */
function periodStep(period: AnalyticsPeriod): number {
  const i = ANALYTICS_PERIODS.indexOf(period);
  return i < 0 ? 0 : i;
}

/** Calendar days the window covers, summed from its buckets. */
function periodDays(buckets: readonly PeriodBucket[]): number {
  return buckets.reduce((sum, b) => sum + b.days, 0);
}

function bookingSeries(buckets: readonly PeriodBucket[]): readonly SeriesPoint[] {
  return buckets.map((b) => ({ label: b.label, value: b.bookings }));
}

function bookingTotals(period: AnalyticsPeriod, buckets: readonly PeriodBucket[]): BookingTotals {
  const rates = PERIOD_RATES[period];
  const bookings = buckets.reduce((sum, b) => sum + b.bookings, 0);
  const days = periodDays(buckets);
  return {
    bookings,
    days,
    avgDaily: Math.round(bookings / Math.max(1, days)),
    successPct: rates.successPct,
    cancelPct: rates.cancelPct,
    noShowPct: rates.noShowPct,
    bookingsDeltaPct: rates.bookingsDeltaPct,
    avgDailyDeltaPct: rates.avgDailyDeltaPct,
    cancelDeltaPct: rates.cancelDeltaPct,
  };
}

/** Department mix: seeds drifted by the period step, then normalised to 100. */
function deptShares(period: AnalyticsPeriod, bookings: number): readonly DeptShare[] {
  const step = periodStep(period);
  const drifted = DEPT_SHARE_SEEDS.map((d) => ({
    dept: d.dept,
    raw: Math.max(0.5, d.base + d.drift * step),
  }));
  const total = drifted.reduce((sum, d) => sum + d.raw, 0);
  return drifted
    .map((d) => {
      const share = (d.raw / total) * 100;
      return {
        dept: d.dept,
        pct: pct1(share),
        bookings: Math.round((bookings * share) / 100),
      };
    })
    .sort((a, b) => b.pct - a.pct);
}

/** Usage leaderboard: shares drifted by the period step, highest first. */
function hospitalUsage(period: AnalyticsPeriod, bookings: number): readonly HospitalUsage[] {
  const step = periodStep(period);
  return HOSPITAL_USAGE_SEEDS.map((h) => {
    const share = Math.max(0.5, h.share + h.drift * step);
    return {
      hid: h.hid,
      pct: pct1(share),
      bookings: Math.round((bookings * share) / 100),
    };
  }).sort((a, b) => b.bookings - a.bookings);
}

function usageHealth(usagePct: number): UsageHealth {
  if (usagePct >= USAGE_CRITICAL_PCT) return 'critical';
  if (usagePct >= USAGE_WARNING_PCT) return 'warning';
  return 'healthy';
}

/** Provider consumption, plan allowance and spend for the window. */
function providerUsage(days: number): readonly ProviderUsage[] {
  return PROVIDER_SEEDS.map((p) => {
    const used = p.dailyUnits * days;
    const allowance = Math.round((p.monthlyAllowance * days) / ALLOWANCE_DAYS);
    const usagePct = pct1((used / Math.max(1, allowance)) * 100);
    return {
      id: p.id,
      name: p.name,
      channel: p.channel,
      icon: p.icon,
      unit: p.unit,
      used,
      allowance,
      creditsLeft: Math.max(0, allowance - used),
      overage: Math.max(0, used - allowance),
      usagePct,
      costPaise: used * p.unitCostPaise,
      health: usageHealth(usagePct),
      color: p.color,
    };
  });
}

function errorHealth(errorPct: number, p95Ms: number): UsageHealth {
  if (errorPct >= ERROR_PCT_CRITICAL || p95Ms >= P95_CRITICAL_MS) return 'critical';
  if (errorPct >= ERROR_PCT_WARNING || p95Ms >= P95_WARNING_MS) return 'warning';
  return 'healthy';
}

/**
 * Error and latency figures per provider / API surface.
 *
 * The per-bucket error percentage oscillates around the seed's baseline along
 * a fixed wave offset by the row index, so the trend is different per row and
 * per period but identical on every render. Row totals are summed from the
 * buckets rather than quoted separately — the table and the trend chart can
 * therefore never disagree.
 */
function errorRates(buckets: readonly PeriodBucket[]): readonly ErrorRateRow[] {
  return ERROR_RATE_SEEDS.map((seed, rowIndex) => {
    let requests = 0;
    let errors = 0;
    let peakWave = 0;
    const trend = buckets.map((b, bucketIndex) => {
      const wave = TREND_WAVE[(rowIndex + bucketIndex) % TREND_WAVE.length];
      peakWave = Math.max(peakWave, wave);
      const bucketRequests = seed.dailyRequests * b.days;
      const bucketPct = pct2(seed.baseErrorPct * wave);
      requests += bucketRequests;
      errors += Math.round((bucketRequests * bucketPct) / 100);
      return { label: b.label, value: bucketPct };
    });
    const errorPct = pct2((errors / Math.max(1, requests)) * 100);
    // A busier window is a slower window: latency follows the worst bucket.
    const p95Ms = Math.round(seed.baseP95Ms * peakWave);
    return {
      id: seed.id,
      scope: seed.scope,
      name: seed.name,
      requests,
      errors,
      errorPct,
      p95Ms,
      trend,
      health: errorHealth(errorPct, p95Ms),
    };
  });
}

/** Everything the analytics screen shows for `period`. */
export function deriveAnalytics(period: AnalyticsPeriod): AnalyticsSnapshot {
  const buckets = PERIOD_SERIES[period];
  const totals = bookingTotals(period, buckets);
  return {
    period,
    buckets,
    series: bookingSeries(buckets),
    totals,
    depts: deptShares(period, totals.bookings),
    hospitals: hospitalUsage(period, totals.bookings),
    providers: providerUsage(totals.days),
    errors: errorRates(buckets),
  };
}

/** Platform-wide request/error roll-up across every row. */
export interface ErrorSummary {
  readonly requests: number;
  readonly errors: number;
  readonly errorPct: number;
  readonly worstP95Ms: number;
  readonly flagged: number;
}

export function summariseErrors(rows: readonly ErrorRateRow[]): ErrorSummary {
  const requests = rows.reduce((sum, r) => sum + r.requests, 0);
  const errors = rows.reduce((sum, r) => sum + r.errors, 0);
  return {
    requests,
    errors,
    errorPct: pct2((errors / Math.max(1, requests)) * 100),
    worstP95Ms: rows.reduce((worst, r) => Math.max(worst, r.p95Ms), 0),
    flagged: rows.filter((r) => r.health !== 'healthy').length,
  };
}

/** Aggregate error percentage per bucket, weighted by request volume. */
export function aggregateErrorTrend(
  rows: readonly ErrorRateRow[],
  buckets: readonly PeriodBucket[],
): readonly SeriesPoint[] {
  return buckets.map((b, i) => {
    let requests = 0;
    let errors = 0;
    rows.forEach((row, rowIndex) => {
      const seed = ERROR_RATE_SEEDS[rowIndex];
      const bucketRequests = seed.dailyRequests * b.days;
      const bucketPct = row.trend[i]?.value ?? 0;
      requests += bucketRequests;
      errors += (bucketRequests * bucketPct) / 100;
    });
    return { label: b.label, value: pct2((errors / Math.max(1, requests)) * 100) };
  });
}

/** Total spend across providers, in paise. */
export function totalSpendPaise(providers: readonly ProviderUsage[]): number {
  return providers.reduce((sum, p) => sum + p.costPaise, 0);
}

/** Paise → whole rupees, for display through the shared `money()` formatter. */
export function rupeesFromPaise(paise: number): number {
  return Math.round(paise / PAISE_PER_RUPEE);
}
