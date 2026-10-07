import { useState } from 'react';

import { isFailure } from '@/core/error/failure';
import { downloadCsv, type CsvCell } from '@/shared/lib/download';
import { money, rupeesFixed } from '@/shared/lib/format';
import { ErrorState } from '@/shared/ui/ErrorState';
import { KpiStrip } from '@/shared/ui/KpiStrip';
import { SkeletonCards, SkeletonKpiStrip } from '@/shared/ui/Skeleton';
import type { StatCardData } from '@/shared/ui/StatCard';
import { toast } from '@/shared/ui/toast/toast.store';

import type {
  AnalyticsOverview,
  AnalyticsWindow,
  ApiErrorRow,
} from '@/features/ops-analytics/domain/entities/analytics.entities';
import { useAnalyticsOverviewQuery } from '@/features/ops-analytics/application/queries/useAnalyticsOverviewQuery';
import { useApiErrorsQuery } from '@/features/ops-analytics/application/queries/useApiErrorsQuery';
import { useBookingsByMonthQuery } from '@/features/ops-analytics/application/queries/useBookingsByMonthQuery';
import { useDepartmentsSplitQuery } from '@/features/ops-analytics/application/queries/useDepartmentsSplitQuery';
import { useProviderUsageQuery } from '@/features/ops-analytics/application/queries/useProviderUsageQuery';
import { useTopHospitalsQuery } from '@/features/ops-analytics/application/queries/useTopHospitalsQuery';
import { useAnalyticsStore } from '@/features/ops-analytics/application/store/analytics.store';
import { AnalyticsHeader } from '@/features/ops-analytics/presentation/components/AnalyticsHeader';
import {
  deptRows,
  errorRows,
  hospitalRows,
  monthSeries,
  PERIOD_CODE,
  pct,
  providerRows,
  surfaceRows,
  windowDays,
  windowLabel,
  type DeptRow,
  type ErrorRow,
  type HospitalRow,
  type ProviderRow,
} from '@/features/ops-analytics/presentation/components/analytics.view';
import { BookingsTrendCard } from '@/features/ops-analytics/presentation/components/BookingsTrendCard';
import { DepartmentSplitCard } from '@/features/ops-analytics/presentation/components/DepartmentSplitCard';
import { ErrorRatesCard } from '@/features/ops-analytics/presentation/components/ErrorRatesCard';
import { ErrorsBySurfaceCard } from '@/features/ops-analytics/presentation/components/ErrorsBySurfaceCard';
import { ProviderSpendCard } from '@/features/ops-analytics/presentation/components/ProviderSpendCard';
import { ProviderUsageCard } from '@/features/ops-analytics/presentation/components/ProviderUsageCard';
import { TopHospitalsByUsageCard } from '@/features/ops-analytics/presentation/components/TopHospitalsByUsageCard';

const ALL_SCOPES = 'All scopes';
const ONE_DECIMAL = 10;
const LOAD_FAILED = 'Analytics could not be loaded. Please try again.';

/** Overview metrics in the bookings CSV, in reading order. */
const OVERVIEW_CSV: readonly (readonly [string, (o: AnalyticsOverview) => CsvCell])[] = [
  ['Total bookings', (o) => o.bookingsTotal],
  ['Online bookings', (o) => o.bookingsOnline],
  ['Walk-in bookings', (o) => o.bookingsWalkIn],
  ['Completed', (o) => o.completed],
  ['Cancellations', (o) => o.cancellations],
  ['No-shows', (o) => o.noShows],
  ['Revenue (INR)', (o) => rupeesFixed(o.revenueRupees)],
  ['Refunds (INR)', (o) => rupeesFixed(o.refundsRupees)],
  ['New patients', (o) => o.newPatients],
];

function bookingKpis(o: AnalyticsOverview): readonly StatCardData[] {
  const days = windowDays(o.window);
  return [
    {
      icon: 'calendar-check',
      label: 'Total Bookings',
      value: o.bookingsTotal.toLocaleString('en-IN'),
      sub: `${o.bookingsOnline.toLocaleString('en-IN')} online · ${o.bookingsWalkIn.toLocaleString('en-IN')} walk-in`,
      iconClass: 'bg-blue-soft-bg text-text-navy',
      valueClass: 'text-text-navy',
      subClass: 'text-text-muted',
    },
    {
      icon: 'trending-up',
      label: 'Avg Daily Bookings',
      value: (Math.round((o.bookingsTotal / days) * ONE_DECIMAL) / ONE_DECIMAL).toLocaleString(
        'en-IN',
      ),
      sub: windowLabel(o.window),
      iconClass: 'bg-blue-soft-bg text-blue',
      valueClass: 'text-blue',
      subClass: 'text-text-muted',
    },
    {
      icon: 'circle-check',
      label: 'Booking Success Rate',
      value: `${pct(o.completed, o.bookingsTotal)}%`,
      sub: 'Completed vs total bookings',
      iconClass: 'bg-g-100 text-g-800',
      valueClass: 'text-g-800',
    },
    {
      icon: 'circle-x',
      label: 'Cancellation Rate',
      value: `${pct(o.cancellations, o.bookingsTotal)}%`,
      sub: `${pct(o.noShows, o.bookingsTotal)}% no-show`,
      iconClass: 'bg-badge-noshow-bg text-orange-strong',
      valueClass: 'text-orange-strong',
      subClass: 'text-text-muted',
    },
  ];
}

function providerKpis(
  rows: readonly ProviderRow[],
  window: AnalyticsWindow,
): readonly StatCardData[] {
  const spend = rows.reduce((sum, p) => sum + p.costRupees, 0);
  const requests = rows.reduce((sum, p) => sum + p.requests, 0);
  const messages = rows.reduce((sum, p) => sum + p.messages, 0);
  const errors = rows.reduce((sum, p) => sum + p.errors, 0);
  return [
    {
      icon: 'indian-rupee',
      label: 'Provider Spend',
      value: money(spend),
      sub: `${rows.length} providers · ${windowLabel(window)}`,
      iconClass: 'bg-g-100 text-g-800',
      valueClass: 'text-g-800',
      subClass: 'text-text-muted',
    },
    {
      icon: 'activity',
      label: 'Provider Requests',
      value: requests.toLocaleString('en-IN'),
      sub: 'Calls made to third-party providers',
      iconClass: 'bg-blue-soft-bg text-blue',
      valueClass: 'text-blue',
      subClass: 'text-text-muted',
    },
    {
      icon: 'send',
      label: 'Messages Sent',
      value: messages.toLocaleString('en-IN'),
      sub: 'SMS, WhatsApp, email and push',
      iconClass: 'bg-blue-soft-bg text-text-navy',
      valueClass: 'text-text-navy',
      subClass: 'text-text-muted',
    },
    {
      icon: 'triangle-alert',
      label: 'Provider Errors',
      value: errors.toLocaleString('en-IN'),
      sub: `${pct(errors, requests)}% of requests`,
      iconClass: errors > 0 ? 'bg-d-100 text-d-600' : 'bg-grey-300 text-text-muted',
      valueClass: errors > 0 ? 'text-d-600' : 'text-text-muted',
      subClass: 'text-text-muted',
    },
  ];
}

function errorKpis(
  api: readonly ApiErrorRow[],
  rows: readonly ErrorRow[],
): readonly StatCardData[] {
  const requests = api.reduce((sum, r) => sum + r.requests, 0);
  const failed = api.reduce((sum, r) => sum + r.errors4xx + r.errors5xx, 0);
  const server = api.reduce((sum, r) => sum + r.errors5xx, 0);
  const worstP95 = api.reduce((worst, r) => Math.max(worst, r.p95Ms), 0);
  const flagged = rows.filter((r) => r.health !== 'healthy').length;
  return [
    {
      icon: 'activity',
      label: 'API Requests',
      value: requests.toLocaleString('en-IN'),
      sub: `Across ${api.length} surface and endpoint groups`,
      iconClass: 'bg-blue-soft-bg text-text-navy',
      valueClass: 'text-text-navy',
      subClass: 'text-text-muted',
    },
    {
      icon: 'circle-x',
      label: 'Failed Requests',
      value: failed.toLocaleString('en-IN'),
      sub: `${server.toLocaleString('en-IN')} server errors (5xx)`,
      iconClass: 'bg-d-100 text-d-600',
      valueClass: 'text-d-600',
      subClass: 'text-text-muted',
    },
    {
      icon: 'percent',
      label: 'Error Rate',
      value: `${pct(failed, requests)}%`,
      sub: 'Failed share of all API requests',
      iconClass: 'bg-y-100 text-y-800',
      valueClass: 'text-y-800',
      subClass: 'text-text-muted',
    },
    {
      icon: 'hourglass',
      label: 'Worst p95 Latency',
      value: `${worstP95.toLocaleString('en-IN')} ms`,
      sub: `${flagged} of ${rows.length} rows flagged`,
      iconClass: 'bg-blue-soft-bg text-blue',
      valueClass: 'text-blue',
      subClass: 'text-text-muted',
    },
  ];
}

interface BookingsView {
  readonly window: AnalyticsWindow;
  readonly overview: AnalyticsOverview;
  readonly series: ReturnType<typeof monthSeries>;
  readonly depts: readonly DeptRow[];
  readonly hospitals: readonly HospitalRow[];
}

function bookingCsvRows(v: BookingsView): readonly (readonly CsvCell[])[] {
  return [
    ...OVERVIEW_CSV.map(([label, read]) => ['Overview', label, read(v.overview), null]),
    ...v.series.map((m) => ['Bookings by month', m.label, m.value, null]),
    ...v.depts.map((d) => ['Department split', d.label, d.bookings, d.pct]),
    ...v.hospitals.map((h) => ['Top hospitals', h.name, h.bookings, h.pct]),
  ];
}

function providerCsvRows(rows: readonly ProviderRow[]): readonly (readonly CsvCell[])[] {
  return rows.map((p) => [
    p.label,
    p.id,
    p.requests,
    p.messages,
    p.errors,
    p.errorPct,
    p.costRupees,
    p.health,
  ]);
}

function errorCsvRows(rows: readonly ErrorRow[]): readonly (readonly CsvCell[])[] {
  return rows.map((r) => [r.scope, r.name, r.requests, r.errors, r.errorPct, r.p95Ms, r.health]);
}

const CSV_HEADERS = {
  Bookings: ['Section', 'Label', 'Value', 'Share %'],
  Providers: [
    'Provider',
    'Code',
    'Requests',
    'Messages',
    'Errors',
    'Error %',
    'Cost (INR)',
    'Status',
  ],
  'Error Rates': [
    'Scope',
    'Provider / surface',
    'Requests',
    'Errors',
    'Error %',
    'p95 latency (ms)',
    'Status',
  ],
} as const;

/**
 * Ops → Usage Analytics (design `OpsAnalytics`), on the platform analytics
 * API (`/platform/analytics/*`, nightly rollups — every window ends
 * yesterday).
 *
 * Each tab fetches only what it shows, for the selected period: Bookings reads
 * the overview, monthly bookings, department split and top hospitals;
 * Providers reads metered provider usage; Error Rates reads the API error
 * rollup plus provider failures. The export writes a CSV of exactly the
 * server figures on screen.
 */
export function OpsAnalyticsScreen() {
  const period = useAnalyticsStore((s) => s.period);
  const tab = useAnalyticsStore((s) => s.tab);
  const setPeriod = useAnalyticsStore((s) => s.setPeriod);
  const setTab = useAnalyticsStore((s) => s.setTab);
  const [scope, setScope] = useState<string>(ALL_SCOPES);

  const code = PERIOD_CODE[period];
  const isBookings = tab === 'Bookings';
  const isProviders = tab === 'Providers';
  const isErrors = tab === 'Error Rates';

  const overview = useAnalyticsOverviewQuery(code, isBookings);
  const months = useBookingsByMonthQuery(code, isBookings);
  const depts = useDepartmentsSplitQuery(code, isBookings);
  const top = useTopHospitalsQuery(code, isBookings);
  const providers = useProviderUsageQuery(code, isProviders || isErrors);
  const apiErrors = useApiErrorsQuery(code, isErrors);

  const active = isBookings
    ? [overview, months, depts, top]
    : isProviders
      ? [providers]
      : [providers, apiErrors];
  const failed = active.find((q) => q.isLoadingError);
  const isLoading = active.some((q) => q.isPending);

  const bookings: BookingsView | null =
    overview.data && months.data && depts.data && top.data
      ? {
          window: overview.data.window,
          overview: overview.data,
          series: monthSeries(months.data.items),
          depts: deptRows(depts.data.items),
          hospitals: hospitalRows(top.data.items, overview.data.bookingsTotal),
        }
      : null;
  const providerList = providers.data ? providerRows(providers.data.items) : null;
  const errorList =
    providerList && apiErrors.data ? errorRows(providerList, apiErrors.data.items) : null;

  const exportRows = isBookings
    ? bookings
      ? bookingCsvRows(bookings)
      : []
    : isProviders
      ? providerList
        ? providerCsvRows(providerList)
        : []
      : errorList
        ? errorCsvRows(errorList)
        : [];
  const shownWindow = isBookings ? overview.data?.window : providers.data?.window;

  /**
   * THE LAW: the file is written first, then the toast reports what landed —
   * with the row count, so the claim is checkable.
   */
  const handleExport = (): void => {
    if (!shownWindow) return;
    const slug = tab.toLowerCase().replace(/\s+/g, '-');
    downloadCsv(`medibook-analytics-${slug}-${shownWindow.dateFrom}-to-${shownWindow.dateTo}.csv`, [
      CSV_HEADERS[tab],
      ...exportRows,
    ]);
    toast(
      `Exported ${exportRows.length} ${tab.toLowerCase()} rows for ${windowLabel(shownWindow)}.`,
    );
  };

  const retry = (): void => {
    for (const q of active) if (q.isLoadingError) void q.refetch();
  };

  const header = (
    <AnalyticsHeader
      tab={tab}
      onTab={setTab}
      period={period}
      onPeriod={setPeriod}
      onExport={handleExport}
      exportRows={exportRows.length}
      exportDisabled={isLoading || failed !== undefined}
    />
  );

  if (failed) {
    return (
      <div className="flex flex-col gap-5">
        {header}
        <ErrorState
          error={failed.error}
          title="Analytics didn't load"
          message={isFailure(failed.error) ? failed.error.message : LOAD_FAILED}
          onRetry={retry}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {header}

      {isBookings && bookings && (
        <>
          <KpiStrip items={bookingKpis(bookings.overview)} />
          <div className="grid items-stretch gap-5 lg:grid-cols-[2fr_1fr]">
            <BookingsTrendCard series={bookings.series} bucketLabel="Per month" period={period} />
            <DepartmentSplitCard depts={bookings.depts} />
          </div>
          <TopHospitalsByUsageCard hospitals={bookings.hospitals} />
        </>
      )}

      {isProviders && providerList && providers.data && (
        <>
          <KpiStrip items={providerKpis(providerList, providers.data.window)} />
          <ProviderSpendCard providers={providerList} period={period} />
          <ProviderUsageCard providers={providerList} period={period} />
        </>
      )}

      {isErrors && errorList && apiErrors.data && (
        <>
          <KpiStrip items={errorKpis(apiErrors.data.items, errorList)} />
          <ErrorsBySurfaceCard
            rows={surfaceRows(apiErrors.data.items).filter((r) => r.errors > 0)}
            title="Errors by API Surface"
            period={period}
          />
          <ErrorRatesCard rows={errorList} period={period} scope={scope} onScope={setScope} />
        </>
      )}

      {isLoading && (
        <>
          <SkeletonKpiStrip count={4} />
          <SkeletonCards count={2} lines={4} />
        </>
      )}
    </div>
  );
}
