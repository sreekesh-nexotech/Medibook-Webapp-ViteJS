import { useState } from 'react';

import { isFailure } from '@/core/error/failure';
import type { SortAccessors } from '@/shared/hooks/useSort';
import { useSort } from '@/shared/hooks/useSort';
import { cn } from '@/shared/lib/cn';
import { downloadCsv } from '@/shared/lib/download';
import { fmtDate } from '@/shared/lib/format';
import { dateRange } from '@/shared/lib/validate';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { ClearChip } from '@/shared/ui/ClearChip';
import { Icon } from '@/shared/ui/Icon';
import { InfoDot } from '@/shared/ui/InfoDot';
import { KpiStrip } from '@/shared/ui/KpiStrip';
import { Pager } from '@/shared/ui/Pager';
import { RefreshBtn } from '@/shared/ui/RefreshBtn';
import { SectionTitle } from '@/shared/ui/SectionTitle';
import { SegTabs } from '@/shared/ui/SegTabs';
import { SkeletonKpiStrip } from '@/shared/ui/Skeleton';
import type { StatCardData } from '@/shared/ui/StatCard';
import { TableShell, tdClass } from '@/shared/ui/TableShell';
import type { TableStateSpec } from '@/shared/ui/TableState';
import { toast } from '@/shared/ui/toast/toast.store';

import { useSettlementPeriodsQuery } from '@/features/settlements/application/queries/useSettlementPeriodsQuery';
import type {
  SettlementPeriod,
  SettlementPeriodFilters,
} from '@/features/settlements/domain/entities/settlements.entities';
import { PlanBilling } from '@/features/settlements/presentation/components/PlanBilling';
import { SettlementPeriodDrawer } from '@/features/settlements/presentation/components/SettlementPeriodDrawer';
import {
  effectiveRate,
  fmtDateTime,
  PERIOD_STATUS,
  periodLabel,
  rupees,
  rupeesShort,
} from '@/features/settlements/presentation/components/settlementsFormat';

const PAGE = 7;
const KPI_COUNT = 4;
const PERCENT = 100;
const PAISE_PER_RUPEE = 100;

const TAB_SETTLEMENTS = 'Settlements';
const TAB_PLAN = 'Plan & Billing';

/** Sort accessors for the settlement records table. */
const ACC: SortAccessors<SettlementPeriod> = {
  period: (r) => r.periodStart,
  gross: (r) => r.grossPaise,
  commission: (r) => r.commissionPaise,
  net: (r) => r.netPayablePaise,
  status: (r) => PERIOD_STATUS[r.status].label,
};

const SETTLEMENT_COLUMNS = [
  'Settlement Period',
  'Gross Amount',
  'Commission',
  'Net Payable',
  'Status',
  'Action',
] as const;

const SORT_KEYS: Readonly<Record<string, string>> = {
  'Settlement Period': 'period',
  'Gross Amount': 'gross',
  Commission: 'commission',
  'Net Payable': 'net',
  Status: 'status',
};

function sumNet(list: readonly SettlementPeriod[]): number {
  return list.reduce((a, r) => a + r.netPayablePaise, 0);
}

/**
 * Billing & Settlements (admin) — the settlement ledger from
 * `GET /hospital/settlements/periods` plus the Plan & Billing tab.
 *
 * The hospital side of the ledger is read-only: Medibook closes periods and
 * releases payouts, and the hospital sees each period's breakdown, payout and
 * statement in the detail drawer. The date range is filtered on the server;
 * KPIs, search, sort, paging and the CSV work on the fetched window (the
 * latest 100 periods, about two years of weekly settlements).
 */
export function SettlementsScreen() {
  const [tab, setTab] = useState(TAB_SETTLEMENTS);
  const [opened, setOpened] = useState<SettlementPeriod | null>(null);
  const [q, setQ] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(0);
  const { sort, onSort, sorted } = useSort<SettlementPeriod>();

  const rangeError = from !== '' && to !== '' ? dateRange(from, to) : undefined;
  // An inverted range is flagged inline and not sent to the server.
  const filters: SettlementPeriodFilters = rangeError
    ? {}
    : { dateFrom: from || undefined, dateTo: to || undefined };
  const periodsQuery = useSettlementPeriodsQuery(filters);

  const periods = periodsQuery.data?.items ?? [];
  const hasMore = periodsQuery.data?.hasMore ?? false;

  const refresh = async (): Promise<void> => {
    await periodsQuery.refetch();
  };

  const ql = q.trim().toLowerCase();
  const filtered = periods.filter(
    (r) =>
      ql === '' ||
      `${periodLabel(r.periodStart, r.periodEnd)} ${PERIOD_STATUS[r.status].label}`
        .toLowerCase()
        .includes(ql),
  );

  const total = sumNet(periods);
  const paid = sumNet(periods.filter((r) => r.status === 'paid'));
  const onHold = periods.filter((r) => r.status === 'on_hold');
  const accruing = sumNet(periods.filter((r) => r.status === 'open'));
  const windowNote = hasMore ? `latest ${periods.length} periods` : `${periods.length} periods`;

  const KPIS: readonly StatCardData[] = [
    {
      icon: 'wallet',
      label: 'Total Net Payable',
      value: rupeesShort(total),
      sub: windowNote,
      iconClass: 'bg-blue-soft-bg text-blue',
      valueClass: 'text-blue',
    },
    {
      icon: 'circle-check',
      label: 'Paid Out',
      value: rupeesShort(paid),
      sub: `${total ? Math.round((paid / total) * PERCENT) : 0}% of total`,
      iconClass: 'bg-g-100 text-g-600',
      valueClass: 'text-g-600',
    },
    {
      icon: 'triangle-alert',
      label: 'On Hold',
      value: rupees(sumNet(onHold)),
      sub: `${onHold.length} period${onHold.length === 1 ? '' : 's'}`,
      iconClass: 'bg-d-100 text-d-500',
      valueClass: 'text-d-500',
    },
    {
      icon: 'clock',
      label: 'Current Period (Accruing)',
      value: rupees(accruing),
      sub: 'net so far, paid out after the period closes',
      iconClass: 'bg-y-100 text-y-600',
      valueClass: 'text-y-600',
    },
  ];

  const ordered = sorted(filtered, ACC);
  const pages = Math.max(1, Math.ceil(ordered.length / PAGE));
  const pg = Math.min(page, pages - 1);
  const rows = ordered.slice(pg * PAGE, pg * PAGE + PAGE);
  const onFilter =
    (fn: (v: string) => void) =>
    (v: string): void => {
      fn(v);
      setPage(0);
    };
  const filtersActive = q !== '' || from !== '' || to !== '';
  const clearFilters = (): void => {
    setQ('');
    setFrom('');
    setTo('');
    setPage(0);
  };

  let tableState: TableStateSpec | undefined;
  if (periodsQuery.isPending) tableState = { kind: 'loading', rows: 5 };
  else if (periodsQuery.isError)
    tableState = {
      kind: 'error',
      message: isFailure(periodsQuery.error) ? periodsQuery.error.message : undefined,
      onRetry: () => void periodsQuery.refetch(),
    };
  else if (rows.length === 0)
    tableState = {
      kind: 'empty',
      icon: 'scale',
      title: filtersActive ? 'No settlements match your filters.' : 'No settlements yet.',
      message: filtersActive
        ? 'Widen the date range or clear the search.'
        : 'Settlement periods appear here once Medibook has collected online booking fees.',
      actionLabel: filtersActive ? 'Clear filters' : undefined,
      onAction: filtersActive ? clearFilters : undefined,
    };

  /** Real CSV file of the rows the filters select — amounts in rupees. */
  const exportCsv = (): void => {
    const inRupees = (paise: number): number => paise / PAISE_PER_RUPEE;
    downloadCsv('medibook-settlements.csv', [
      [
        'Period start',
        'Period end',
        'Status',
        'Gross',
        'Refunds',
        'Gateway fees',
        'Commission incl. GST',
        'Commission incl. GST %',
        'Adjustments',
        'TDS',
        'Net payable',
      ],
      ...filtered.map((r) => [
        fmtDate(r.periodStart),
        fmtDate(r.periodEnd),
        PERIOD_STATUS[r.status].label,
        inRupees(r.grossPaise),
        inRupees(r.refundsPaise),
        inRupees(r.gatewayFeesPaise),
        inRupees(r.commissionPaise),
        effectiveRate(r.commissionPaise, r.grossPaise),
        inRupees(r.adjustmentsPaise),
        inRupees(r.tdsPaise),
        inRupees(r.netPayablePaise),
      ]),
    ]);
    toast('Exported medibook-settlements.csv', 'success');
  };

  return (
    <div className="flex flex-col gap-5">
      <Card pad={16} className="flex flex-wrap items-center justify-between gap-3">
        <SegTabs tabs={[TAB_SETTLEMENTS, TAB_PLAN]} value={tab} onChange={setTab} />
        {tab === TAB_SETTLEMENTS && (
          <div className="flex items-center gap-2.5">
            <RefreshBtn onRefresh={refresh} title="Refresh settlements" />
            <Button
              variant="secondary"
              icon="download"
              onClick={exportCsv}
              disabled={filtered.length === 0}
            >
              Export CSV
            </Button>
          </div>
        )}
      </Card>

      {tab === TAB_PLAN ? (
        <PlanBilling />
      ) : (
        <>
          {periodsQuery.isPending ? (
            <SkeletonKpiStrip count={KPI_COUNT} />
          ) : periodsQuery.isError ? null : (
            <KpiStrip items={KPIS} />
          )}
          <Card pad={16} className="flex flex-wrap items-center gap-3.5">
            <span className="text-body text-text-muted">Periods between</span>
            <input
              type="date"
              value={from}
              aria-label="Periods ending on or after"
              aria-invalid={rangeError ? true : undefined}
              onChange={(e) => onFilter(setFrom)(e.target.value)}
              className="border-border text-body text-text-body h-11 rounded-md border px-3.5"
            />
            <span className="text-body text-text-muted">and</span>
            <input
              type="date"
              value={to}
              aria-label="Periods starting on or before"
              aria-invalid={rangeError ? true : undefined}
              onChange={(e) => onFilter(setTo)(e.target.value)}
              className="border-border text-body text-text-body h-11 rounded-md border px-3.5"
            />
            {(from || to) && (
              <ClearChip
                label="Clear dates"
                onClick={() => {
                  setFrom('');
                  setTo('');
                  setPage(0);
                }}
              />
            )}
            {rangeError && (
              <span className="text-caption text-d-700 inline-flex items-center gap-1.5">
                <Icon name="triangle-alert" size={13} /> {rangeError}
              </span>
            )}
            <span className="flex-1" />
            <div className="text-caption text-text-muted flex items-center gap-1.75">
              <InfoDot text="Medibook collects online booking fees upfront, deducts refunds, gateway fees and its platform commission, and transfers the net to your bank account after each period closes. Open a period to see the full breakdown, the payout and its transfer reference." />{' '}
              Commission shown as charged on each period
            </div>
          </Card>
          <Card pad={20}>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <SectionTitle size={16}>Settlement Records</SectionTitle>
              <div className="border-border text-text-muted flex h-10.5 w-65 items-center gap-2.5 rounded-lg border px-3.5">
                <Icon name="search" size={17} />
                <input
                  value={q}
                  onChange={(e) => onFilter(setQ)(e.target.value)}
                  aria-label="Search settlements by date or status"
                  placeholder="Search by date or status"
                  className="text-body text-text-strong flex-1 border-none bg-transparent outline-none"
                />
              </div>
            </div>
            <TableShell
              columns={SETTLEMENT_COLUMNS}
              rightCols={['Gross Amount', 'Commission', 'Net Payable']}
              sortKeys={SORT_KEYS}
              sort={sort}
              onSort={onSort}
              state={tableState}
              scrollLabel="Settlement records"
            >
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-grey-200 transition-colors duration-150">
                  <td className={cn(tdClass, 'text-text-strong font-medium')}>
                    {periodLabel(r.periodStart, r.periodEnd)}
                    {r.closedAt && (
                      <div className="text-caption text-text-muted font-normal">
                        Closed {fmtDateTime(r.closedAt)}
                      </div>
                    )}
                  </td>
                  <td className={cn(tdClass, 'text-right tabular-nums')}>{rupees(r.grossPaise)}</td>
                  <td className={cn(tdClass, 'text-right tabular-nums')}>
                    {rupees(r.commissionPaise)}
                    <div className="text-caption text-text-muted">
                      {effectiveRate(r.commissionPaise, r.grossPaise)} incl. GST
                    </div>
                  </td>
                  <td
                    className={cn(
                      tdClass,
                      'text-text-strong text-right font-semibold tabular-nums',
                    )}
                  >
                    {rupees(r.netPayablePaise)}
                  </td>
                  <td className={tdClass}>
                    <Badge status={PERIOD_STATUS[r.status].badge}>
                      {PERIOD_STATUS[r.status].label}
                    </Badge>
                  </td>
                  <td className={tdClass}>
                    <Button size="sm" variant="secondary" icon="eye" onClick={() => setOpened(r)}>
                      Details
                    </Button>
                  </td>
                </tr>
              ))}
            </TableShell>
            <Pager
              total={filtered.length}
              page={pg}
              pageSize={PAGE}
              onPage={setPage}
              noun="settlements"
              right={
                <span className="text-body text-text-navy font-medium tabular-nums">
                  Net due: {rupees(sumNet(filtered.filter((r) => r.status !== 'paid')))}
                </span>
              }
            />
            {hasMore && (
              <div className="text-caption text-text-muted mt-3">
                Showing the latest {periods.length} of {periodsQuery.data?.total ?? 0} periods.
                Narrow the date range to see older ones.
              </div>
            )}
          </Card>
        </>
      )}

      <SettlementPeriodDrawer period={opened} onClose={() => setOpened(null)} />
    </div>
  );
}
