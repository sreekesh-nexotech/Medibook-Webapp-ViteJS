import { fmtDate } from '@/shared/lib/format';
import type { IconName } from '@/shared/ui/icon-registry';

import {
  ERROR_PCT_CRITICAL,
  ERROR_PCT_WARNING,
  P95_CRITICAL_MS,
  P95_WARNING_MS,
} from '@/features/ops-analytics/domain/entities/analytics.entities';
import type {
  AnalyticsPeriodCode,
  AnalyticsWindow,
  ApiErrorRow,
  DepartmentShare,
  MonthlyBookings,
  ProviderUsage,
  TopHospital,
} from '@/features/ops-analytics/domain/entities/analytics.entities';
import type { AnalyticsPeriod } from '@/features/ops-analytics/application/store/analytics.types';

/**
 * Server analytics → what the cards draw: labels, shares, health flags.
 * Pure functions; no React.
 */

/** The period select's labels → the backend's `?period=` codes. */
export const PERIOD_CODE: Readonly<Record<AnalyticsPeriod, AnalyticsPeriodCode>> = {
  'Last 7 days': '7d',
  'Last 30 days': '30d',
  'Last 90 days': '90d',
  'Last 12 months': '12m',
};

/** How a measured figure compares with its alert threshold. */
export type Health = 'healthy' | 'warning' | 'critical';

export interface ChartPoint {
  readonly label: string;
  readonly value: number;
}

export interface DeptRow {
  readonly code: string;
  readonly label: string;
  readonly pct: number;
  readonly bookings: number;
}

export interface HospitalRow {
  readonly id: string;
  readonly name: string;
  readonly bookings: number;
  /** Share of the window's platform bookings, one decimal. */
  readonly pct: number;
}

export interface ProviderRow {
  readonly id: string;
  readonly label: string;
  readonly icon: IconName;
  /** Segment colour for the spend donut (a design token, never raw hex). */
  readonly color: string;
  readonly requests: number;
  readonly messages: number;
  readonly errors: number;
  readonly errorPct: number;
  readonly costRupees: number;
  readonly health: Health;
}

export type ErrorScope = 'Provider' | 'API';

export interface ErrorRow {
  readonly id: string;
  readonly scope: ErrorScope;
  readonly name: string;
  readonly sub: string;
  readonly requests: number;
  readonly errors: number;
  readonly errorPct: number;
  /** `null` for providers — latency is measured for our own API only. */
  readonly p95Ms: number | null;
  readonly health: Health;
}

const MONTHS_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

const PERCENT = 100;
const ONE_DECIMAL = 10;
const TWO_DECIMALS = 100;
/** `yyyy` → `yy` for a month label that spans two years. */
const YEAR_SUFFIX_START = 2;

interface ProviderMeta {
  readonly label: string;
  readonly icon: IconName;
  readonly color: string;
}

/** The providers the backend meters (`analytics/services/rollup.py` `PROVIDERS`). */
const PROVIDER_META: Readonly<Record<string, ProviderMeta>> = {
  sms: { label: 'SMS', icon: 'message-circle', color: 'var(--color-blue)' },
  whatsapp: { label: 'WhatsApp', icon: 'smartphone', color: 'var(--color-g-800)' },
  email: { label: 'Email', icon: 'mail', color: 'var(--color-p-500)' },
  push: { label: 'Push notifications', icon: 'bell-ring', color: 'var(--color-y-800)' },
  razorpay: {
    label: 'Payments · Razorpay',
    icon: 'credit-card',
    color: 'var(--color-orange-strong)',
  },
  storage: { label: 'File storage', icon: 'layers', color: 'var(--color-d-600)' },
  clamav: { label: 'Virus scan · ClamAV', icon: 'shield-check', color: 'var(--color-text-navy)' },
};

/** API surfaces (`analytics/middleware.py` `surface_of`). */
const SURFACE_LABELS: Readonly<Record<string, string>> = {
  patient: 'Patient app',
  hospital: 'Hospital app',
  platform: 'Ops console',
  display: 'Display screens',
  shared: 'Shared',
  webhook: 'Webhooks',
};

/** `n / d` as a percentage, one decimal; 0 when there is nothing to divide by. */
export function pct(n: number, d: number): number {
  return d > 0 ? Math.round((n / d) * PERCENT * ONE_DECIMAL) / ONE_DECIMAL : 0;
}

/** `general_medicine` → "General medicine". */
export function humanize(code: string): string {
  const spaced = code.replaceAll('_', ' ').replaceAll('-', ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** "1 Sep 2026 – 30 Sep 2026" — the window a response covers. */
export function windowLabel(window: AnalyticsWindow): string {
  return `${fmtDate(window.dateFrom)} – ${fmtDate(window.dateTo)}`;
}

/** Inclusive days in the window. */
export function windowDays(window: AnalyticsWindow): number {
  const ms = Date.parse(window.dateTo) - Date.parse(window.dateFrom);
  const DAY_MS = 86_400_000;
  return Math.max(1, Math.round(ms / DAY_MS) + 1);
}

/** Error share and latency against the alert thresholds. */
export function healthOf(errorPct: number, p95Ms: number | null): Health {
  const p95 = p95Ms ?? 0;
  if (errorPct >= ERROR_PCT_CRITICAL || p95 >= P95_CRITICAL_MS) return 'critical';
  if (errorPct >= ERROR_PCT_WARNING || p95 >= P95_WARNING_MS) return 'warning';
  return 'healthy';
}

/** One bar per month: "Sep", or "Sep 25" when the window spans two years. */
export function monthSeries(months: readonly MonthlyBookings[]): readonly ChartPoint[] {
  const years = new Set(months.map((m) => m.month.slice(0, 4)));
  return months.map((m) => {
    const [year = '', month = '1'] = m.month.split('-');
    const name = MONTHS_SHORT[Number(month) - 1] ?? m.month;
    return {
      label: years.size > 1 ? `${name} ${year.slice(YEAR_SUFFIX_START)}` : name,
      value: m.total,
    };
  });
}

export function deptRows(depts: readonly DepartmentShare[]): readonly DeptRow[] {
  return depts.map((d) => ({
    code: d.departmentCode,
    label: humanize(d.departmentCode),
    pct: Math.round(d.sharePct * ONE_DECIMAL) / ONE_DECIMAL,
    bookings: d.bookings,
  }));
}

export function hospitalRows(
  hospitals: readonly TopHospital[],
  totalBookings: number,
): readonly HospitalRow[] {
  return hospitals.map((h) => ({
    id: h.hospitalId,
    name: h.name ?? 'Removed hospital',
    bookings: h.bookings,
    pct: pct(h.bookings, totalBookings),
  }));
}

export function providerRows(providers: readonly ProviderUsage[]): readonly ProviderRow[] {
  return providers.map((p) => {
    const meta = PROVIDER_META[p.provider] ?? {
      label: humanize(p.provider),
      icon: 'sliders-horizontal',
      color: 'var(--color-grey-500)',
    };
    const errorPct = pct(p.errors, p.requests);
    return {
      id: p.provider,
      label: meta.label,
      icon: meta.icon,
      color: meta.color,
      requests: p.requests,
      messages: p.messages,
      errors: p.errors,
      errorPct,
      costRupees: p.costRupees,
      health: healthOf(errorPct, null),
    };
  });
}

/** Provider integrations and our own API surfaces, in one comparable list. */
export function errorRows(
  providers: readonly ProviderRow[],
  api: readonly ApiErrorRow[],
): readonly ErrorRow[] {
  const fromProviders: ErrorRow[] = providers
    .filter((p) => p.requests > 0)
    .map((p) => ({
      id: `provider-${p.id}`,
      scope: 'Provider',
      name: p.label,
      sub: 'Third-party integration',
      requests: p.requests,
      errors: p.errors,
      errorPct: p.errorPct,
      p95Ms: null,
      health: p.health,
    }));
  const fromApi: ErrorRow[] = api.map((r) => {
    const errorPct = Math.round(r.errorPct * TWO_DECIMALS) / TWO_DECIMALS;
    return {
      id: `api-${r.surface}-${r.endpointGroup}`,
      scope: 'API',
      name: `${SURFACE_LABELS[r.surface] ?? humanize(r.surface)} · ${r.endpointGroup}`,
      sub: `${r.errors5xx.toLocaleString('en-IN')} server · ${r.errors4xx.toLocaleString('en-IN')} client errors`,
      requests: r.requests,
      errors: r.errors4xx + r.errors5xx,
      errorPct,
      p95Ms: r.p95Ms,
      health: healthOf(errorPct, r.p95Ms),
    };
  });
  return [...fromProviders, ...fromApi];
}

/** Failed requests per API surface (all endpoint groups summed), worst first. */
export function surfaceRows(api: readonly ApiErrorRow[]): readonly ErrorRow[] {
  const bySurface = new Map<string, { requests: number; errors: number; p95: number }>();
  for (const r of api) {
    const s = bySurface.get(r.surface) ?? { requests: 0, errors: 0, p95: 0 };
    bySurface.set(r.surface, {
      requests: s.requests + r.requests,
      errors: s.errors + r.errors4xx + r.errors5xx,
      p95: Math.max(s.p95, r.p95Ms),
    });
  }
  return [...bySurface.entries()]
    .map(([surface, s]): ErrorRow => {
      const errorPct = pct(s.errors, s.requests);
      return {
        id: surface,
        scope: 'API',
        name: SURFACE_LABELS[surface] ?? humanize(surface),
        sub: '',
        requests: s.requests,
        errors: s.errors,
        errorPct,
        p95Ms: s.p95,
        health: healthOf(errorPct, s.p95),
      };
    })
    .sort((a, b) => b.errors - a.errors);
}
