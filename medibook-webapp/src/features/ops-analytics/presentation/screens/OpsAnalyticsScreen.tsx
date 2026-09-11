import { useState } from 'react';

import { downloadCsv, type CsvCell } from '@/shared/lib/download';
import { money } from '@/shared/lib/format';
import { KpiStrip } from '@/shared/ui/KpiStrip';
import type { StatCardData } from '@/shared/ui/StatCard';
import { toast } from '@/shared/ui/toast/toast.store';

import {
  aggregateErrorTrend,
  deriveAnalytics,
  rupeesFromPaise,
  summariseErrors,
  totalSpendPaise,
} from '@/features/ops-analytics/application/store/analytics.derive';
import { useAnalyticsStore } from '@/features/ops-analytics/application/store/analytics.store';
import type { AnalyticsSnapshot } from '@/features/ops-analytics/application/store/analytics.types';
import { AnalyticsHeader } from '@/features/ops-analytics/presentation/components/AnalyticsHeader';
import { BookingsTrendCard } from '@/features/ops-analytics/presentation/components/BookingsTrendCard';
import { DepartmentSplitCard } from '@/features/ops-analytics/presentation/components/DepartmentSplitCard';
import { ErrorRatesCard } from '@/features/ops-analytics/presentation/components/ErrorRatesCard';
import { ErrorsBySurfaceCard } from '@/features/ops-analytics/presentation/components/ErrorsBySurfaceCard';
import { ErrorTrendCard } from '@/features/ops-analytics/presentation/components/ErrorTrendCard';
import { ProviderSpendCard } from '@/features/ops-analytics/presentation/components/ProviderSpendCard';
import { ProviderUsageCard } from '@/features/ops-analytics/presentation/components/ProviderUsageCard';
import { TopHospitalsByUsageCard } from '@/features/ops-analytics/presentation/components/TopHospitalsByUsageCard';

import { hospName } from '@/features/ops-hospitals/application/store/hospitals.store';

/** Longest bucket that still reads as a week rather than a month. */
const WEEK_DAYS = 7;

const ALL_SCOPES = 'All scopes';

/** Signed percentage, so a KPI sub-line reads "+8.2%" / "−2.1%". */
function signedPct(n: number): string {
  const sign = n > 0 ? '+' : n < 0 ? '−' : '';
  return `${sign}${Math.abs(n)}%`;
}

/** A period name as a filename fragment: "Last 30 days" → "last-30-days". */
function periodSlug(period: string): string {
  return period.toLowerCase().replace(/\s+/g, '-');
}

/** What one bucket of the selected period covers. */
function bucketLabel(days: number): string {
  if (days === 1) return 'Per day';
  return days <= WEEK_DAYS ? 'Per week' : 'Per month';
}

function bookingKpis(data: AnalyticsSnapshot): readonly StatCardData[] {
  const t = data.totals;
  return [
    {
      icon: 'calendar-check',
      label: 'Total Bookings',
      value: t.bookings.toLocaleString('en-IN'),
      sub: `${signedPct(t.bookingsDeltaPct)} vs previous ${t.days} days`,
      iconClass: 'bg-blue-soft-bg text-text-navy',
      valueClass: 'text-text-navy',
      subClass: t.bookingsDeltaPct >= 0 ? 'text-g-600' : 'text-d-500',
    },
    {
      icon: 'trending-up',
      label: 'Avg Daily Bookings',
      value: t.avgDaily.toLocaleString('en-IN'),
      sub: `${signedPct(t.avgDailyDeltaPct)} vs previous period`,
      iconClass: 'bg-blue-soft-bg text-blue',
      valueClass: 'text-blue',
      subClass: t.avgDailyDeltaPct >= 0 ? 'text-g-600' : 'text-d-500',
    },
    {
      icon: 'circle-check',
      label: 'Booking Success Rate',
      value: `${t.successPct}%`,
      sub: 'Completed vs total bookings',
      iconClass: 'bg-g-100 text-g-600',
      valueClass: 'text-g-600',
    },
    {
      icon: 'circle-x',
      label: 'Cancellation Rate',
      value: `${t.cancelPct}%`,
      sub: `${signedPct(t.cancelDeltaPct)} vs previous period · ${t.noShowPct}% no-show`,
      iconClass: 'bg-badge-noshow-bg text-orange',
      valueClass: 'text-orange',
      subClass: t.cancelDeltaPct <= 0 ? 'text-g-600' : 'text-d-500',
    },
  ];
}

function providerKpis(data: AnalyticsSnapshot): readonly StatCardData[] {
  const spend = totalSpendPaise(data.providers);
  const units = data.providers.reduce((sum, p) => sum + p.used, 0);
  const overage = data.providers.reduce((sum, p) => sum + p.overage, 0);
  const flagged = data.providers.filter((p) => p.health !== 'healthy');
  return [
    {
      icon: 'indian-rupee',
      label: 'Provider Spend',
      value: money(rupeesFromPaise(spend)),
      sub: `${data.providers.length} providers · ${data.period.toLowerCase()}`,
      iconClass: 'bg-g-100 text-g-600',
      valueClass: 'text-g-600',
      subClass: 'text-text-muted',
    },
    {
      icon: 'send',
      label: 'Units Consumed',
      value: units.toLocaleString('en-IN'),
      sub: 'Messages, notifications, transactions and transfer',
      iconClass: 'bg-blue-soft-bg text-blue',
      valueClass: 'text-blue',
      subClass: 'text-text-muted',
    },
    {
      icon: 'triangle-alert',
      label: 'Over or Near Plan',
      value: String(flagged.length),
      sub: flagged.length > 0 ? flagged.map((p) => p.channel).join(', ') : 'Every provider healthy',
      iconClass: 'bg-y-100 text-y-600',
      valueClass: 'text-y-600',
      subClass: 'text-text-muted',
    },
    {
      icon: 'wallet',
      label: 'Billable Overage',
      value: overage.toLocaleString('en-IN'),
      sub: 'Units consumed beyond the plan allowance',
      iconClass: overage > 0 ? 'bg-d-100 text-d-500' : 'bg-grey-300 text-text-muted',
      valueClass: overage > 0 ? 'text-d-500' : 'text-text-muted',
      subClass: 'text-text-muted',
    },
  ];
}

function errorKpis(data: AnalyticsSnapshot): readonly StatCardData[] {
  const s = summariseErrors(data.errors);
  return [
    {
      icon: 'activity',
      label: 'Requests',
      value: s.requests.toLocaleString('en-IN'),
      sub: `Across ${data.errors.length} providers and surfaces`,
      iconClass: 'bg-blue-soft-bg text-text-navy',
      valueClass: 'text-text-navy',
      subClass: 'text-text-muted',
    },
    {
      icon: 'circle-x',
      label: 'Failed Requests',
      value: s.errors.toLocaleString('en-IN'),
      sub: `${data.period.toLowerCase()}`,
      iconClass: 'bg-d-100 text-d-500',
      valueClass: 'text-d-500',
      subClass: 'text-text-muted',
    },
    {
      icon: 'percent',
      label: 'Error Rate',
      value: `${s.errorPct}%`,
      sub: 'Volume-weighted across everything measured',
      iconClass: 'bg-y-100 text-y-600',
      valueClass: 'text-y-600',
      subClass: 'text-text-muted',
    },
    {
      icon: 'hourglass',
      label: 'Worst p95 Latency',
      value: `${s.worstP95Ms.toLocaleString('en-IN')} ms`,
      sub: `${s.flagged} of ${data.errors.length} rows flagged`,
      iconClass: 'bg-blue-soft-bg text-blue',
      valueClass: 'text-blue',
      subClass: 'text-text-muted',
    },
  ];
}

/** Long-format rows for the bookings tab: the trend, the mix and the leaderboard. */
function bookingCsvRows(data: AnalyticsSnapshot): readonly (readonly CsvCell[])[] {
  const trend = data.buckets.map((b) => [
    'Bookings trend',
    b.label,
    b.days,
    b.bookings,
    Math.round((b.bookings / Math.max(1, data.totals.bookings)) * 1000) / 10,
  ]);
  const depts = data.depts.map((d) => ['Department split', d.dept, null, d.bookings, d.pct]);
  const hospitals = data.hospitals.map((h) => [
    'Top hospitals',
    hospName(h.hid),
    null,
    h.bookings,
    h.pct,
  ]);
  return [...trend, ...depts, ...hospitals];
}

function providerCsvRows(data: AnalyticsSnapshot): readonly (readonly CsvCell[])[] {
  return data.providers.map((p) => [
    p.name,
    p.channel,
    p.unit,
    p.used,
    p.allowance,
    p.creditsLeft,
    p.overage,
    p.usagePct,
    rupeesFromPaise(p.costPaise),
    p.health,
  ]);
}

function errorCsvRows(data: AnalyticsSnapshot): readonly (readonly CsvCell[])[] {
  return data.errors.map((r) => {
    const peak = r.trend.reduce(
      (worst, p) => (p.value > worst.value ? p : worst),
      r.trend[0] ?? { label: '—', value: 0 },
    );
    return [
      r.scope,
      r.name,
      r.requests,
      r.errors,
      r.errorPct,
      r.p95Ms,
      peak.value,
      peak.label,
      r.health,
    ];
  });
}

/**
 * Ops → Usage Analytics (design `OpsAnalytics`), rebuilt for audit 2.5 / SA-05.
 *
 * Every figure is derived from the selected period, so the period control
 * genuinely moves the numbers; provider usage and error rates — which had no
 * screen at all — are the two new sections; and the export writes a real CSV
 * of whatever section is on screen.
 */
export function OpsAnalyticsScreen() {
  const period = useAnalyticsStore((s) => s.period);
  const tab = useAnalyticsStore((s) => s.tab);
  const setPeriod = useAnalyticsStore((s) => s.setPeriod);
  const setTab = useAnalyticsStore((s) => s.setTab);
  const [scope, setScope] = useState<string>(ALL_SCOPES);

  const data = deriveAnalytics(period);
  const apiRows = data.errors.filter((r) => r.scope === 'API');
  const errorTrend = aggregateErrorTrend(data.errors, data.buckets);
  const errorPeakPct = errorTrend.reduce((worst, p) => Math.max(worst, p.value), 0);

  const exportRows =
    tab === 'Bookings'
      ? bookingCsvRows(data)
      : tab === 'Providers'
        ? providerCsvRows(data)
        : errorCsvRows(data);

  const exportHeader: readonly CsvCell[] =
    tab === 'Bookings'
      ? ['Section', 'Label', 'Days', 'Bookings', 'Share %']
      : tab === 'Providers'
        ? [
            'Provider',
            'Channel',
            'Unit',
            'Used',
            'Plan allowance',
            'Credits left',
            'Overage',
            'Usage %',
            'Cost (INR)',
            'Status',
          ]
        : [
            'Scope',
            'Provider / surface',
            'Requests',
            'Errors',
            'Error %',
            'p95 latency (ms)',
            'Peak error %',
            'Peak bucket',
            'Status',
          ];

  /**
   * THE LAW: the file is written first, then the toast reports what landed —
   * with the row count, so the claim is checkable.
   */
  const handleExport = (): void => {
    const name = `medibook-analytics-${tab.toLowerCase().replace(/\s+/g, '-')}-${periodSlug(period)}.csv`;
    downloadCsv(name, [exportHeader, ...exportRows]);
    toast(
      `Exported ${exportRows.length} ${tab.toLowerCase()} rows for ${period.toLowerCase()}.`,
      'success',
    );
  };

  const kpis =
    tab === 'Bookings'
      ? bookingKpis(data)
      : tab === 'Providers'
        ? providerKpis(data)
        : errorKpis(data);

  return (
    <div className="flex flex-col gap-5">
      <AnalyticsHeader
        tab={tab}
        onTab={setTab}
        period={period}
        onPeriod={setPeriod}
        onExport={handleExport}
        exportRows={exportRows.length}
      />
      <KpiStrip items={kpis} />

      {tab === 'Bookings' && (
        <>
          <div className="grid items-stretch gap-5 lg:grid-cols-[2fr_1fr]">
            <BookingsTrendCard
              series={data.series}
              bucketLabel={bucketLabel(data.buckets[0]?.days ?? 1)}
              period={period}
            />
            <DepartmentSplitCard depts={data.depts} />
          </div>
          <TopHospitalsByUsageCard hospitals={data.hospitals} />
        </>
      )}

      {tab === 'Providers' && (
        <>
          <ProviderSpendCard providers={data.providers} period={period} />
          <ProviderUsageCard providers={data.providers} period={period} />
        </>
      )}

      {tab === 'Error Rates' && (
        <>
          <div className="grid items-stretch gap-5 lg:grid-cols-2">
            <ErrorTrendCard trend={errorTrend} period={period} peakPct={errorPeakPct} />
            <ErrorsBySurfaceCard rows={apiRows} title="Errors by API Surface" period={period} />
          </div>
          <ErrorRatesCard rows={data.errors} period={period} scope={scope} onScope={setScope} />
        </>
      )}
    </div>
  );
}
