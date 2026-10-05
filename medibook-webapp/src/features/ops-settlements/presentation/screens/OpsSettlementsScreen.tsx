import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { opsPath } from '@/app/router/paths';
import { useSort } from '@/shared/hooks/useSort';
import { addDaysISO, fmtDate, moneyShort, todayISO } from '@/shared/lib/format';
import { Card } from '@/shared/ui/Card';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { FilterSelect } from '@/shared/ui/FilterSelect';
import { InfoDot } from '@/shared/ui/InfoDot';
import { KpiStrip } from '@/shared/ui/KpiStrip';
import { Pager } from '@/shared/ui/Pager';
import { SectionTitle } from '@/shared/ui/SectionTitle';
import { SegTabs } from '@/shared/ui/SegTabs';
import { SkeletonCards, SkeletonKpiStrip } from '@/shared/ui/Skeleton';
import type { StatCardData } from '@/shared/ui/StatCard';
import { TableShell } from '@/shared/ui/TableShell';
import { toast } from '@/shared/ui/toast/toast.store';

import { hospitalDetailHref } from '@/features/ops-hospitals/presentation/components/hospitals.view';
import { useOpsSettingsStore } from '@/features/ops-settings/application/store/opsSettings.store';

import { useApprovePayoutRunMutation } from '@/features/ops-settlements/application/queries/useApprovePayoutRunMutation';
import { usePayoutRunDetailsQueries } from '@/features/ops-settlements/application/queries/usePayoutRunDetailsQueries';
import { usePayoutRunsQuery } from '@/features/ops-settlements/application/queries/usePayoutRunsQuery';
import { useSettlementPeriodsQuery } from '@/features/ops-settlements/application/queries/useSettlementPeriodsQuery';
import type { PeriodFilter } from '@/features/ops-settlements/domain/entities/opsSettlements.entities';
import { OpsSettlementsCreateRunModal } from '@/features/ops-settlements/presentation/components/OpsSettlementsCreateRunModal';
import {
  buildRows,
  failureText,
  groupRows,
  ROW_STATUSES,
  runnablePeriods,
  windowOf,
  type LedgerRow,
  type RunGroup,
} from '@/features/ops-settlements/presentation/components/opsSettlements.viewModel';
import { PayoutRunCard } from '@/features/ops-settlements/presentation/components/PayoutRunCard';
import { RecordReleaseModal } from '@/features/ops-settlements/presentation/components/RecordReleaseModal';
import { RecordRunReleaseModal } from '@/features/ops-settlements/presentation/components/RecordRunReleaseModal';
import { SettlementDateInput } from '@/features/ops-settlements/presentation/components/SettlementDateInput';
import { SettlementQueueRow } from '@/features/ops-settlements/presentation/components/SettlementQueueRow';

const OPS_SETTLE_PAGE = 7;

/**
 * Paid statements are history: without a date filter the queue shows those
 * whose period ended in this many days. Unpaid ones always show in full.
 */
const PAID_HISTORY_DAYS = 90;

const MONTH_PREFIX_LENGTH = 7;

/**
 * Ops settlement queue — settlement periods from `/platform/settlements/periods`,
 * joined to their payouts through `/platform/settlements/payout-runs`.
 *
 * "By Payout Run" shows real runs (draft → approve → record each transfer's
 * UTR) plus closed periods no run has picked up yet; "Flat List" is every
 * statement in one sortable table. Releases are recorded, not executed — the
 * money moves at the bank (Q7).
 */
export function OpsSettlementsScreen() {
  const navigate = useNavigate();
  // Deferred to Z: the payout cadence is a P13 setting with no reach from P5.
  const payoutSched = useOpsSettingsStore((s) => s.settings.payoutSched);
  const today = todayISO();

  const [viewMode, setViewMode] = useState('By Payout Run');
  const [hospF, setHospF] = useState('All Hospitals');
  const [statusF, setStatusF] = useState('All');
  const [dateF, setDateF] = useState('');
  const [dateT, setDateT] = useState('');
  const [page, setPage] = useState(0);
  const [releaseRow, setReleaseRow] = useState<LedgerRow | null>(null);
  const [runGroup, setRunGroup] = useState<RunGroup | null>(null);
  const [createRun, setCreateRun] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  const historyFrom = dateF || addDaysISO(today, -PAID_HISTORY_DAYS);
  const unpaidFilter: PeriodFilter = {
    statuses: ['open', 'closed', 'on_hold'],
    dateFrom: dateF || null,
    dateTo: dateT || null,
  };
  const paidFilter: PeriodFilter = {
    statuses: ['paid'],
    dateFrom: historyFrom,
    dateTo: dateT || null,
  };
  const unpaidQuery = useSettlementPeriodsQuery(unpaidFilter);
  const paidQuery = useSettlementPeriodsQuery(paidFilter);
  const runsQuery = usePayoutRunsQuery();
  const runs = runsQuery.data ?? [];
  // Released runs only matter while their periods are in the history window.
  const detailRunIds = runs
    .filter((r) => r.status !== 'released' || r.periodEnd >= historyFrom)
    .map((r) => r.id);
  const details = usePayoutRunDetailsQueries(detailRunIds);
  const approve = useApprovePayoutRunMutation();

  const periods = [...(unpaidQuery.data ?? []), ...(paidQuery.data ?? [])];
  const payouts = details.details.flatMap((d) => d.payouts);
  const all = buildRows(periods, payouts, runs, today).sort((a, b) =>
    b.periodStart.localeCompare(a.periodStart),
  );

  const loading =
    unpaidQuery.isLoading || paidQuery.isLoading || runsQuery.isLoading || details.isLoading;
  const loadError = unpaidQuery.error ?? paidQuery.error ?? runsQuery.error;

  const refetchAll = async (): Promise<void> => {
    await Promise.all([
      unpaidQuery.refetch(),
      paidQuery.refetch(),
      runsQuery.refetch(),
      details.refetch(),
    ]);
  };

  const goHosp = (hospitalId: string): void => {
    navigate(hospitalDetailHref(opsPath('hospitals'), hospitalId));
  };

  const filtered = all.filter(
    (r) =>
      (hospF === 'All Hospitals' || r.hospitalName === hospF) &&
      (statusF === 'All' || r.status === statusF),
  );
  const pg = Math.min(page, Math.max(0, Math.ceil(filtered.length / OPS_SETTLE_PAGE) - 1));
  const { sort, onSort, sorted } = useSort<LedgerRow>();
  const ordered = sorted(filtered, {
    id: (r) => r.hospitalName,
    gross: (r) => r.grossRupees,
    commission: (r) => r.commissionRupees,
    net: (r) => r.netRupees,
    expected: (r) => r.expected ?? '',
    status: (r) => r.status,
  });
  const flatRows = ordered.slice(pg * OPS_SETTLE_PAGE, pg * OPS_SETTLE_PAGE + OPS_SETTLE_PAGE);
  const groups = groupRows(filtered, runs);

  const runnable = runnablePeriods(all);
  const runWindow = windowOf(runnable, periods);

  const onRelease = (row: LedgerRow): void => {
    if (!row.payout?.hasBankAccount) {
      toast(
        `No payout account on file for ${row.hospitalName} — the hospital adds it under Hospital Settings.`,
        'error',
      );
    } else setReleaseRow(row);
  };

  const onApprove = (runId: string): void => {
    setApprovingId(runId);
    approve.mutate(runId, {
      onSuccess: (d) => toast(`Payout run ${d.run.runNo} approved — ready to release.`, 'success'),
      onError: (failure) => toast(failureText(failure, 'Could not approve the run.'), 'error'),
      onSettled: () => setApprovingId(null),
    });
  };

  // KPIs — every figure is a sum over the periods and payouts loaded above.
  const month = today.slice(0, MONTH_PREFIX_LENGTH);
  const payable = all.filter((r) => r.releasable);
  const accruing = periods.filter((p) => p.status === 'open');
  const releasedThisMonth = payouts.filter(
    (p) => p.status === 'released' && p.releasedAt?.slice(0, MONTH_PREFIX_LENGTH) === month,
  );
  const earningPeriods = periods.filter((p) => p.periodEnd.slice(0, MONTH_PREFIX_LENGTH) === month);

  const KPIS: readonly StatCardData[] = [
    {
      icon: 'landmark',
      label: 'Payable Now',
      value: moneyShort(payable.reduce((a, b) => a + b.netRupees, 0)),
      sub: `${payable.length} statements pending release`,
      iconClass: 'bg-y-100 text-y-600',
      valueClass: 'text-y-600',
    },
    {
      icon: 'clock',
      label: 'Held in Advance',
      value: moneyShort(accruing.reduce((a, p) => a + p.netPayableRupees, 0)),
      sub: `${accruing.length} open period${accruing.length === 1 ? '' : 's'} · payable after close`,
      iconClass: 'bg-blue-soft-bg text-blue',
      valueClass: 'text-blue',
    },
    {
      icon: 'circle-check',
      label: 'Released This Month',
      value: moneyShort(releasedThisMonth.reduce((a, p) => a + p.amountRupees, 0)),
      sub: `${releasedThisMonth.length} payout${releasedThisMonth.length === 1 ? '' : 's'} recorded`,
      iconClass: 'bg-g-100 text-g-600',
      valueClass: 'text-g-600',
    },
    {
      icon: 'indian-rupee',
      label: 'Platform Earnings',
      value: moneyShort(earningPeriods.reduce((a, p) => a + p.commissionRupees, 0)),
      sub: 'commission on periods ending this month',
      iconClass: 'bg-blue-soft-bg text-text-navy',
      valueClass: 'text-text-navy',
    },
  ];

  const nextRun = runs
    .filter((r) => r.status !== 'released' && r.scheduledFor !== null && r.scheduledFor >= today)
    .map((r) => r.scheduledFor ?? '')
    .sort()[0];

  const filtersActive =
    hospF !== 'All Hospitals' || statusF !== 'All' || dateF !== '' || dateT !== '';
  const clearAll = (): void => {
    setHospF('All Hospitals');
    setStatusF('All');
    setDateF('');
    setDateT('');
    setPage(0);
  };

  if (loadError && periods.length === 0) {
    return (
      <ErrorState
        title="Settlements could not load"
        message={failureText(loadError, 'Retrying usually fixes it — nothing has been lost.')}
        onRetry={() => void refetchAll()}
      />
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {loading ? <SkeletonKpiStrip count={KPIS.length} /> : <KpiStrip items={KPIS} />}
      <Card pad={16} className="flex flex-wrap items-center gap-3">
        <SegTabs tabs={['By Payout Run', 'Flat List']} value={viewMode} onChange={setViewMode} />
        <FilterSelect
          value={hospF}
          aria-label="Filter by hospital"
          options={['All Hospitals', ...new Set(all.map((r) => r.hospitalName))]}
          onChange={(v) => {
            setHospF(v);
            setPage(0);
          }}
        />
        <FilterSelect
          value={statusF === 'All' ? 'Status: All' : statusF}
          aria-label="Filter by settlement status"
          options={['Status: All', ...ROW_STATUSES]}
          onChange={(v) => {
            setStatusF(v === 'Status: All' ? 'All' : v);
            setPage(0);
          }}
        />
        <SettlementDateInput
          value={dateF}
          onChange={(v) => {
            setDateF(v);
            setPage(0);
          }}
          title="Period from"
        />
        <SettlementDateInput
          value={dateT}
          onChange={(v) => {
            setDateT(v);
            setPage(0);
          }}
          title="Period to"
        />
        {filtersActive && (
          <button
            type="button"
            onClick={clearAll}
            className="text-body text-blue cursor-pointer border-none bg-transparent p-0"
          >
            Clear all
          </button>
        )}
        <div className="flex-1"></div>
        <span className="text-caption text-text-muted">
          {payoutSched} payout runs · next: {nextRun ? fmtDate(nextRun) : 'none scheduled'}
        </span>
      </Card>
      <div className="mx-0.5 flex items-center gap-2">
        <SectionTitle>Settlement Queue</SectionTitle>
        <InfoDot text="Online booking fees are collected by Medibook at booking time and become payable to the hospital only after the appointment is completed. Each closed period is a statement, net of refunds, gateway fees, the platform commission, adjustments and TDS. Payout runs batch closed statements: approve a run, then record each bank transfer's UTR — transfers themselves happen outside Medibook, and releases here are the shared record of them." />
        <div className="flex-1"></div>
        <span className="text-caption text-grey-900">
          {filtered.length} statement{filtered.length === 1 ? '' : 's'} match
          {dateF === '' ? ` · paid ones from the last ${PAID_HISTORY_DAYS} days` : ''}
        </span>
      </div>
      {details.isError && (
        <ErrorState
          inline
          title="Some payout runs could not be loaded"
          message={failureText(
            details.error,
            'Their statements show without payout details until they load.',
          )}
          onRetry={() => void details.refetch()}
        />
      )}
      {loading ? (
        <SkeletonCards count={2} lines={4} />
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon="landmark"
            title={
              filtersActive ? 'No settlements match your filters.' : 'No settlement statements yet.'
            }
            message={
              filtersActive
                ? 'Try a wider period range, or clear the filters to see every statement.'
                : 'Statements appear here once a settlement period closes.'
            }
            {...(filtersActive ? { actionLabel: 'Clear filters', onAction: clearAll } : {})}
          />
        </Card>
      ) : viewMode === 'By Payout Run' ? (
        groups.map((g) => (
          <PayoutRunCard
            key={g.key}
            group={g}
            today={today}
            approving={approvingId !== null && approvingId === g.run?.id}
            onApprove={onApprove}
            onReleaseRun={setRunGroup}
            onCreateRun={() => setCreateRun(true)}
            onOpenHosp={goHosp}
            onRelease={onRelease}
          />
        ))
      ) : (
        <Card>
          <TableShell
            columns={[
              'Statement',
              'Gross',
              'Commission',
              'Net Payable',
              'Expected',
              'Status',
              'Action',
            ]}
            rightCols={['Gross', 'Commission', 'Net Payable']}
            sortKeys={{
              Statement: 'id',
              Gross: 'gross',
              Commission: 'commission',
              'Net Payable': 'net',
              Expected: 'expected',
              Status: 'status',
            }}
            sort={sort}
            onSort={onSort}
          >
            {flatRows.map((s) => (
              <SettlementQueueRow
                key={s.id}
                s={s}
                showDate={true}
                onOpenHosp={goHosp}
                onRelease={onRelease}
              />
            ))}
          </TableShell>
          <Pager
            total={filtered.length}
            page={pg}
            pageSize={OPS_SETTLE_PAGE}
            onPage={setPage}
            noun="statements"
          />
        </Card>
      )}
      {releaseRow && <RecordReleaseModal rel={releaseRow} onClose={() => setReleaseRow(null)} />}
      {runGroup && <RecordRunReleaseModal group={runGroup} onClose={() => setRunGroup(null)} />}
      {createRun && runWindow && (
        <OpsSettlementsCreateRunModal
          rows={runnable}
          window={runWindow}
          onClose={() => setCreateRun(false)}
        />
      )}
    </div>
  );
}
