import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { SETTLEMENTS_HOSPITAL_PARAM } from '@/app/router/paths';
import { useOpsPermission } from '@/shared/hooks/useOpsPermission';
import { useSort } from '@/shared/hooks/useSort';
import { addDaysISO, fmtDate, moneyShort, todayISO } from '@/shared/lib/format';
import { Button } from '@/shared/ui/Button';
import { CanOps } from '@/shared/ui/CanOps';
import { Card } from '@/shared/ui/Card';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { FilterSelect } from '@/shared/ui/FilterSelect';
import { InfoDot } from '@/shared/ui/InfoDot';
import { KpiStrip } from '@/shared/ui/KpiStrip';
import { Pager } from '@/shared/ui/Pager';
import { SectionTitle } from '@/shared/ui/SectionTitle';
import { SkeletonCards, SkeletonKpiStrip } from '@/shared/ui/Skeleton';
import type { StatCardData } from '@/shared/ui/StatCard';
import { TableShell } from '@/shared/ui/TableShell';
import { Tabs } from '@/shared/ui/Tabs';
import { toast } from '@/shared/ui/toast/toast.store';

import { useSessionQuery } from '@/features/auth/application/queries/useSessionQuery';
import { useHospitalsQuery } from '@/features/ops-hospitals/application/queries/useHospitalsQuery';
import { useApprovePayoutRunMutation } from '@/features/ops-settlements/application/queries/useApprovePayoutRunMutation';
import { usePayoutRunDetailsQueries } from '@/features/ops-settlements/application/queries/usePayoutRunDetailsQueries';
import { usePayoutRunsQuery } from '@/features/ops-settlements/application/queries/usePayoutRunsQuery';
import { usePayoutsQuery } from '@/features/ops-settlements/application/queries/usePayoutsQuery';
import { useExportSettlementsMutation } from '@/features/ops-settlements/application/queries/useSettlementFileMutations';
import { useSettlementPeriodsQuery } from '@/features/ops-settlements/application/queries/useSettlementPeriodsQuery';
import type {
  PeriodFilter,
  SettlementExportFormat,
} from '@/features/ops-settlements/domain/entities/opsSettlements.entities';
import {
  ClosePeriodModal,
  type HospitalChoice,
} from '@/features/ops-settlements/presentation/components/ClosePeriodModal';
import { OpsSettlementsCreateRunModal } from '@/features/ops-settlements/presentation/components/OpsSettlementsCreateRunModal';
import {
  buildRows,
  failureText,
  groupRows,
  releaseBlocker,
  ROW_STATUSES,
  runnablePeriods,
  saveSettlementFile,
  windowOf,
  type LedgerRow,
  type RunGroup,
} from '@/features/ops-settlements/presentation/components/opsSettlements.viewModel';
import { PayoutRunCard } from '@/features/ops-settlements/presentation/components/PayoutRunCard';
import { PeriodDrawer } from '@/features/ops-settlements/presentation/components/PeriodDrawer';
import { RecordReleaseModal } from '@/features/ops-settlements/presentation/components/RecordReleaseModal';
import { RecordRunReleaseModal } from '@/features/ops-settlements/presentation/components/RecordRunReleaseModal';
import { SettlementDateInput } from '@/features/ops-settlements/presentation/components/SettlementDateInput';
import { SettlementQueueRow } from '@/features/ops-settlements/presentation/components/SettlementQueueRow';
import { StatementsPanel } from '@/features/ops-settlements/presentation/components/StatementsPanel';

const OPS_SETTLE_PAGE = 7;

/**
 * Paid statements are history: without a date filter the queue shows those
 * whose period ended in this many days. Unpaid ones always show in full.
 */
const PAID_HISTORY_DAYS = 90;

const MONTH_PREFIX_LENGTH = 7;

/** The registry is small (10 hospitals in year one); one wide page names them all. */
const HOSPITAL_PICKER_PAGE_SIZE = 100;

const ALL_HOSPITALS = 'All Hospitals';

const TAB_QUEUE = 'By Payout Run';
const TAB_FLAT = 'Flat List';
const TAB_STATEMENTS = 'Statements';

const EXPORT_FORMATS: readonly (readonly [SettlementExportFormat, string])[] = [
  ['csv', 'CSV'],
  ['xlsx', 'Excel'],
  ['pdf', 'PDF'],
];

/**
 * Ops settlement queue — settlement periods from `/platform/settlements/periods`
 * joined to their payouts (one flat `GET …/payouts`, BE-27; each run's detail
 * on an older backend).
 *
 * "By Payout Run" shows real runs (draft → approve → record each transfer's
 * UTR) plus closed periods no run has picked up yet; "Flat List" is every
 * statement in one sortable table; "Statements" lists the monthly platform
 * statements (`billing.view`). A row opens its statement drawer: breakdown,
 * adjustments, Hold / Fail. Close Period previews before it closes. No
 * accruing figures (decision 11). Releases are recorded, not executed — the
 * money moves at the bank (Q7).
 */
export function OpsSettlementsScreen() {
  const today = todayISO();
  const { can } = useOpsPermission();
  const canStatements = can('billing.view');
  const [searchParams, setSearchParams] = useSearchParams();
  const hospitalId = searchParams.get(SETTLEMENTS_HOSPITAL_PARAM);
  const me = useSessionQuery('platform').data?.user.id ?? null;

  const [viewMode, setViewMode] = useState(TAB_QUEUE);
  const [statusF, setStatusF] = useState('All');
  const [dateF, setDateF] = useState('');
  const [dateT, setDateT] = useState('');
  const [page, setPage] = useState(0);
  const [releaseRow, setReleaseRow] = useState<LedgerRow | null>(null);
  const [openRow, setOpenRow] = useState<LedgerRow | null>(null);
  const [runGroup, setRunGroup] = useState<RunGroup | null>(null);
  const [createRun, setCreateRun] = useState(false);
  const [closing, setClosing] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  const canListHospitals = can('hospitals.view');
  const hospitalsQuery = useHospitalsQuery(
    {
      page: 1,
      pageSize: HOSPITAL_PICKER_PAGE_SIZE,
      q: '',
      statuses: [],
      planId: null,
      sort: 'name',
    },
    canListHospitals,
  );

  const historyFrom = dateF || addDaysISO(today, -PAID_HISTORY_DAYS);
  const scope = hospitalId ? { hospitalId } : {};
  const unpaidFilter: PeriodFilter = {
    statuses: ['closed', 'on_hold'],
    dateFrom: dateF || null,
    dateTo: dateT || null,
    ...scope,
  };
  const paidFilter: PeriodFilter = {
    statuses: ['paid'],
    dateFrom: historyFrom,
    dateTo: dateT || null,
    ...scope,
  };
  const unpaidQuery = useSettlementPeriodsQuery(unpaidFilter);
  const paidQuery = useSettlementPeriodsQuery(paidFilter);
  const runsQuery = usePayoutRunsQuery();
  const runs = runsQuery.data ?? [];
  const payoutsQuery = usePayoutsQuery({ hospitalId });
  // A backend without the flat list (null) is read run by run, as before.
  const legacyPayouts = payoutsQuery.isSuccess && payoutsQuery.data === null;
  const detailRunIds = legacyPayouts
    ? runs.filter((r) => r.status !== 'released' || r.periodEnd >= historyFrom).map((r) => r.id)
    : [];
  const details = usePayoutRunDetailsQueries(detailRunIds);
  const approve = useApprovePayoutRunMutation();
  const exporter = useExportSettlementsMutation();

  const periods = [...(unpaidQuery.data ?? []), ...(paidQuery.data ?? [])];
  // The registry names the picker; without `hospitals.view` the loaded periods do.
  const hospitals: HospitalChoice[] = canListHospitals
    ? (hospitalsQuery.data?.items ?? []).map((h) => ({ id: h.id, name: h.name }))
    : [...new Map(periods.map((p) => [p.hospitalId, p.hospitalName] as const))].map(
        ([id, name]) => ({ id, name }),
      );
  const hospitalNameOf = (id: string): string | null =>
    hospitals.find((h) => h.id === id)?.name ?? null;
  const payouts = legacyPayouts
    ? details.details.flatMap((d) => d.payouts)
    : (payoutsQuery.data ?? []);
  const all = buildRows(periods, payouts, runs, today).sort((a, b) =>
    b.periodStart.localeCompare(a.periodStart),
  );

  const loading =
    unpaidQuery.isLoading ||
    paidQuery.isLoading ||
    runsQuery.isLoading ||
    payoutsQuery.isLoading ||
    details.isLoading;
  const loadError = unpaidQuery.error ?? paidQuery.error ?? runsQuery.error ?? payoutsQuery.error;

  const refetchAll = async (): Promise<void> => {
    await Promise.all([
      unpaidQuery.refetch(),
      paidQuery.refetch(),
      runsQuery.refetch(),
      payoutsQuery.refetch(),
      details.refetch(),
    ]);
  };

  const setHospital = (id: string | null): void => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (id) next.set(SETTLEMENTS_HOSPITAL_PARAM, id);
        else next.delete(SETTLEMENTS_HOSPITAL_PARAM);
        return next;
      },
      { replace: true },
    );
    setPage(0);
  };

  const filtered = all.filter((r) => statusF === 'All' || r.status === statusF);
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

  // 09·F7: the run picks up every hospital's closed, unpaid statements in its
  // window whatever the filters, so it is offered only on the whole queue.
  const runnable = hospitalId ? [] : runnablePeriods(all);
  const runWindow = windowOf(runnable, periods);

  const onRelease = (row: LedgerRow): void => {
    const blocker = releaseBlocker(row.payout);
    if (blocker) {
      toast(
        `${row.hospitalName}'s payout can't be released: ${blocker}. Hold or fail it from the statement and pay it in a new run once the account is verified.`,
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

  const runExport = (format: SettlementExportFormat): void => {
    exporter.mutate(
      {
        format,
        filter: {
          statuses: ['closed', 'on_hold', 'paid'],
          dateFrom: dateF || null,
          dateTo: dateT || null,
          ...scope,
        },
      },
      {
        onSuccess: (file) => {
          saveSettlementFile(file);
          toast(`Exported ${file.filename}`, 'success');
        },
        onError: (failure) => toast(failureText(failure, 'The export failed.'), 'error'),
      },
    );
  };

  // KPIs — sums over the periods and payouts loaded above; nothing accrues (decision 11).
  const month = today.slice(0, MONTH_PREFIX_LENGTH);
  const payable = all.filter((r) => r.releasable);
  const awaitingApproval = all.filter((r) => r.run?.status === 'draft');
  const releasedThisMonth = payouts.filter(
    (p) => p.status === 'released' && p.releasedAt?.slice(0, MONTH_PREFIX_LENGTH) === month,
  );
  const earningPeriods = periods.filter((p) => p.periodEnd.slice(0, MONTH_PREFIX_LENGTH) === month);

  const KPIS: readonly StatCardData[] = [
    {
      icon: 'landmark',
      label: 'Payable Now',
      value: moneyShort(payable.reduce((a, b) => a + b.netRupees, 0)),
      sub: `${payable.length} statement${payable.length === 1 ? '' : 's'} in approved runs`,
      iconClass: 'bg-y-100 text-y-600',
      valueClass: 'text-y-600',
    },
    {
      icon: 'clock',
      label: 'Awaiting Approval',
      value: moneyShort(awaitingApproval.reduce((a, b) => a + b.netRupees, 0)),
      sub: `${awaitingApproval.length} statement${awaitingApproval.length === 1 ? '' : 's'} in draft runs`,
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
      label: 'Platform Commission',
      value: moneyShort(earningPeriods.reduce((a, p) => a + p.commissionRupees, 0)),
      sub: 'incl. GST, on statements ending this month',
      iconClass: 'bg-blue-soft-bg text-text-navy',
      valueClass: 'text-text-navy',
    },
  ];

  const nextRun = runs
    .filter((r) => r.status !== 'released' && r.scheduledFor !== null && r.scheduledFor >= today)
    .map((r) => r.scheduledFor ?? '')
    .sort()[0];

  const filtersActive = hospitalId !== null || statusF !== 'All' || dateF !== '' || dateT !== '';
  const clearAll = (): void => {
    setHospital(null);
    setStatusF('All');
    setDateF('');
    setDateT('');
    setPage(0);
  };

  const tabs = canStatements ? [TAB_QUEUE, TAB_FLAT, TAB_STATEMENTS] : [TAB_QUEUE, TAB_FLAT];
  const onStatements = viewMode === TAB_STATEMENTS && canStatements;
  const selectedHospital = hospitalId ? (hospitalNameOf(hospitalId) ?? 'Selected hospital') : null;

  if (loadError && periods.length === 0 && !onStatements) {
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
        <Tabs tabs={tabs} value={viewMode} onChange={setViewMode} ariaLabel="Settlements view" />
        <FilterSelect
          value={selectedHospital ?? ALL_HOSPITALS}
          aria-label="Filter by hospital"
          options={[ALL_HOSPITALS, ...hospitals.map((h) => h.name)]}
          onChange={(v) => setHospital(hospitals.find((h) => h.name === v)?.id ?? null)}
        />
        {!onStatements && (
          <>
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
          </>
        )}
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
        {!onStatements && (
          <span className="text-caption text-text-muted">
            Next payout run: {nextRun ? fmtDate(nextRun) : 'none scheduled'}
          </span>
        )}
      </Card>
      {onStatements ? (
        <Card>
          <StatementsPanel hospitalId={hospitalId} hospitalName={hospitalNameOf} />
        </Card>
      ) : (
        <>
          <div className="mx-0.5 flex flex-wrap items-center gap-2">
            <SectionTitle>Settlement Queue</SectionTitle>
            <InfoDot text="Online booking fees are collected by Medibook at booking time and become payable to the hospital after the appointment is completed. Closing a period freezes each hospital's ledger for those dates into a statement, net of refunds, gateway fees, the platform commission (with its GST) and adjustments. Payout runs batch closed statements for hospitals whose payout account platform finance has verified: approve a run, then record each bank transfer's UTR — transfers happen outside Medibook." />
            <span className="text-caption text-grey-900">
              {filtered.length} statement{filtered.length === 1 ? '' : 's'} match
              {dateF === '' ? ` · paid ones from the last ${PAID_HISTORY_DAYS} days` : ''}
            </span>
            <div className="flex-1"></div>
            <span className="text-caption text-text-muted">Export</span>
            {EXPORT_FORMATS.map(([format, label]) => (
              <Button
                key={format}
                size="sm"
                variant="secondary"
                disabled={exporter.isPending}
                onClick={() => runExport(format)}
              >
                {label}
              </Button>
            ))}
            {/* SEC-05: closing periods needs settlements.edit. */}
            <CanOps perm="settlements.edit">
              <Button size="sm" icon="lock" onClick={() => setClosing(true)}>
                Close Period
              </Button>
            </CanOps>
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
          {hospitalId && (
            <div className="text-caption text-text-muted mx-0.5">
              Showing {selectedHospital}. A payout run pays every hospital in its window, so clear
              the hospital filter to create one.
            </div>
          )}
          {loading ? (
            <SkeletonCards count={2} lines={4} />
          ) : filtered.length === 0 ? (
            <Card>
              <EmptyState
                icon="landmark"
                title={
                  filtersActive
                    ? 'No settlements match your filters.'
                    : 'No settlement statements yet.'
                }
                message={
                  filtersActive
                    ? 'Try a wider period range, or clear the filters to see every statement.'
                    : 'Statements appear here once a settlement period is closed.'
                }
                {...(filtersActive
                  ? { actionLabel: 'Clear filters', onAction: clearAll }
                  : can('settlements.edit')
                    ? { actionLabel: 'Close a period', onAction: () => setClosing(true) }
                    : {})}
              />
            </Card>
          ) : viewMode === TAB_QUEUE ? (
            groups.map((g) => (
              <PayoutRunCard
                key={g.key}
                group={g}
                today={today}
                approving={approvingId !== null && approvingId === g.run?.id}
                runnableCount={runnable.length}
                createdByMe={me !== null && g.run?.initiatedById === me}
                onApprove={onApprove}
                onReleaseRun={setRunGroup}
                onCreateRun={() => setCreateRun(true)}
                onOpen={setOpenRow}
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
                    onOpen={setOpenRow}
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
        </>
      )}
      {openRow && (
        <PeriodDrawer
          row={openRow}
          onOpenStatements={
            canStatements
              ? () => {
                  setOpenRow(null);
                  setViewMode(TAB_STATEMENTS);
                }
              : null
          }
          onClose={() => setOpenRow(null)}
        />
      )}
      {releaseRow && <RecordReleaseModal rel={releaseRow} onClose={() => setReleaseRow(null)} />}
      {runGroup && <RecordRunReleaseModal group={runGroup} onClose={() => setRunGroup(null)} />}
      {createRun && runWindow && (
        <OpsSettlementsCreateRunModal
          rows={runnable}
          window={runWindow}
          hospitalName={hospitalNameOf}
          onClose={() => setCreateRun(false)}
        />
      )}
      {closing && (
        <ClosePeriodModal
          hospitals={hospitals}
          supportsPreview={payoutsQuery.isSuccess && payoutsQuery.data !== null}
          onClose={() => setClosing(false)}
        />
      )}
    </div>
  );
}
