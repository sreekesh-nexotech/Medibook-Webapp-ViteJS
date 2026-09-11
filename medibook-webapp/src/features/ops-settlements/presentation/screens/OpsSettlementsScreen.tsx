import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { opsHospitalDetailPath } from '@/app/router/paths';
import { SETTLE_COMMISSION } from '@/core/config/demo';
import { useInboxStore } from '@/features/ops-dashboard/application/store/inbox.store';
import {
  bankOf,
  hospName,
  opsHospById,
} from '@/features/ops-hospitals/application/store/hospitals.store';
import { useLogsStore } from '@/features/ops-logs/application/store/logs.store';
import { useOpsSettingsStore } from '@/features/ops-settings/application/store/opsSettings.store';
import { useOpsSettlementsStore } from '@/features/ops-settlements/application/store/opsSettlements.store';
import { useSettlementsStore } from '@/features/settlements/application/store/settlements.store';
import { useOpsAct } from '@/shared/hooks/useOpsAct';
import { useSort } from '@/shared/hooks/useSort';
import { fmtDate, money, moneyShort } from '@/shared/lib/format';
import { Card } from '@/shared/ui/Card';
import { EmptyState } from '@/shared/ui/EmptyState';
import { FilterSelect } from '@/shared/ui/FilterSelect';
import { InfoDot } from '@/shared/ui/InfoDot';
import { KpiStrip } from '@/shared/ui/KpiStrip';
import { Pager } from '@/shared/ui/Pager';
import { SectionTitle } from '@/shared/ui/SectionTitle';
import { SegTabs } from '@/shared/ui/SegTabs';
import type { StatCardData } from '@/shared/ui/StatCard';
import { TableShell } from '@/shared/ui/TableShell';
import { toast } from '@/shared/ui/toast/toast.store';

import { PayoutRunCard } from '../components/PayoutRunCard';
import { RecordReleaseModal } from '../components/RecordReleaseModal';
import { RecordRunReleaseModal } from '../components/RecordRunReleaseModal';
import { SettlementDateInput } from '../components/SettlementDateInput';
import { SettlementQueueRow } from '../components/SettlementQueueRow';
import {
  releasable,
  type PayoutRun,
  type RelErr,
  type ReleasePatch,
  type SettlementRow,
} from '../components/settlement-model';

const OPS_SETTLE_PAGE = 7;

/** Ops payout-run queue — merges the Apollo ledger with the ops-side rows. */
export function OpsSettlementsScreen() {
  const navigate = useNavigate();
  const apolloSettlements = useSettlementsStore((s) => s.settlements);
  const opsSettlements = useOpsSettlementsStore((s) => s.settlements);
  const commissionStr = useOpsSettingsStore((s) => s.settings.commission);
  const payoutSched = useOpsSettingsStore((s) => s.settings.payoutSched);

  const [viewMode, setViewMode] = useState('By Payout Run');
  const [releaseId, setReleaseId] = useState<string | null>(null);
  const [runDate, setRunDate] = useState<string | null>(null);
  const [runRemark, setRunRemark] = useState('');
  const [hospF, setHospF] = useState('All Hospitals');
  const [statusF, setStatusF] = useState('All');
  const [dateF, setDateF] = useState('');
  const [dateT, setDateT] = useState('');
  const [page, setPage] = useState(0);
  const [busy, run] = useOpsAct();
  const [relAmt, setRelAmt] = useState('');
  const [relRef, setRelRef] = useState('');
  const [relRemark, setRelRemark] = useState('');
  const [relErr, setRelErr] = useState<RelErr>({});

  const opsComm = (): number => {
    const n = parseFloat(commissionStr);
    return Number.isFinite(n) && n >= 0 && n <= 100 ? n / 100 : SETTLE_COMMISSION;
  };
  const opsCommPct = (): string => `${Math.round(opsComm() * 100)}%`;

  // Shared ledger: Apollo's statements come from the SAME store the hospital
  // app reads/writes. Rows join on hid; display names resolve via hospName().
  const apolloRows: readonly SettlementRow[] = apolloSettlements.map((r) => ({
    ...r,
    apollo: true,
  }));
  const opsRows: readonly SettlementRow[] = opsSettlements.map((r): SettlementRow => ({
    ...r,
    apollo: false,
    commission: Math.round(r.gross * opsComm()),
    net: Math.round(r.gross * (1 - opsComm())),
    utr: r.utr ?? null,
    remark: r.remark ?? null,
    receivedOn: r.receivedOn ?? null,
  }));
  const all = [...apolloRows, ...opsRows].sort((a, b) =>
    String(b.expected || '').localeCompare(String(a.expected || '')),
  );

  const goHosp = (hid: number): void => {
    if (hid && opsHospById(hid)) navigate(opsHospitalDetailPath(hid));
  };

  const filtered = all.filter(
    (r) =>
      (hospF === 'All Hospitals' || hospName(r) === hospF) &&
      (statusF === 'All' || r.status === statusF) &&
      (!dateF || (r.expected || '') >= dateF) &&
      (!dateT || (r.expected || '') <= dateT),
  );
  const pg = Math.min(page, Math.max(0, Math.ceil(filtered.length / OPS_SETTLE_PAGE) - 1));
  const { sort, onSort, sorted } = useSort<SettlementRow>();
  const ordered = sorted(filtered, {
    id: (r) => r.id,
    gross: (r) => r.gross,
    commission: (r) => r.commission,
    net: (r) => r.net,
    expected: (r) => r.expected || '',
    status: (r) => r.status,
  });
  const flatRows = ordered.slice(pg * OPS_SETTLE_PAGE, pg * OPS_SETTLE_PAGE + OPS_SETTLE_PAGE);

  // Payout-run grouping — one group per expected date, newest first.
  const runs: PayoutRun[] = [];
  filtered.forEach((r) => {
    const key = r.expected || 'unscheduled';
    let g = runs.find((x) => x.date === key);
    if (!g) {
      g = { date: key, rows: [] };
      runs.push(g);
    }
    g.rows.push(r);
  });
  runs.sort((a, b) => String(b.date).localeCompare(String(a.date)));

  const rel = all.find((r) => r.id === releaseId);
  const relBank = rel ? (bankOf(rel.hid) ?? null) : null;
  const payable = all.filter(releasable);

  const applyReleasePatch = (r: SettlementRow, patch: ReleasePatch): void => {
    if (r.apollo) useSettlementsStore.getState().settleRelease(r.id, patch);
    else useOpsSettlementsStore.getState().applyReleasePatch(r.id, patch);
    useInboxStore.getState().closeRequests((q) => q.type === 'Settlement' && q.detail === r.id);
  };

  const openRelease = (row: SettlementRow): void => {
    setRelAmt(String(row.net));
    setRelRef('UTR26-' + String(row.id).slice(-4) + 'R');
    setRelRemark(row.status === 'Payout failed' ? 'Re-released after failed payout.' : '');
    setRelErr({});
    setReleaseId(row.id);
  };

  const onRelease = (row: SettlementRow): void => {
    if (!bankOf(row.hid)) {
      toast(
        `No payout account on file for ${hospName(row)} — the hospital adds it under Hospital Settings.`,
        'error',
      );
    } else openRelease(row);
  };

  const recordRelease = (): void => {
    if (!rel) return;
    const amt = parseInt(String(relAmt).replace(/[^0-9]/g, ''), 10);
    const e: RelErr = {
      amt: amt > 0 ? null : 'Enter the released amount.',
      ref: relRef.trim() ? null : 'Enter the bank transfer reference.',
    };
    setRelErr(e);
    if (e.amt || e.ref) return;
    run('release', `Release recorded — visible to ${hospName(rel)}.`, () => {
      applyReleasePatch(rel, {
        utr: relRef.trim(),
        releasedAmt: amt,
        remark: relRemark.trim() || null,
        requested: false,
      });
      useLogsStore.getState().addLog({
        hid: rel.hid,
        action: `Settlement release recorded — ${rel.id} · ${money(amt)} to ${rel.hospital}`,
        module: 'Settlements',
        sev: 'Info',
      });
      setReleaseId(null);
    });
  };

  const runTarget = runDate ? (runs.find((g) => g.date === runDate) ?? null) : null;
  const runRel = runTarget ? runTarget.rows.filter((r) => releasable(r) && bankOf(r.hid)) : [];
  const runSkip = runTarget ? runTarget.rows.filter((r) => releasable(r) && !bankOf(r.hid)) : [];

  const doRunRelease = (): void => {
    if (!runTarget || runRel.length === 0) return;
    const n = runRel.length;
    const total = runRel.reduce((a, r) => a + r.net, 0);
    const date = runTarget.date;
    run('runrel', `Payout run recorded — ${n} settlement${n === 1 ? '' : 's'} released.`, () => {
      runRel.forEach((r) =>
        applyReleasePatch(r, {
          utr: 'UTR26-' + String(r.id).slice(-4) + 'R',
          releasedAmt: r.net,
          remark: runRemark.trim() || null,
          requested: false,
        }),
      );
      useLogsStore.getState().addLog({
        action: `Payout run recorded — ${date === 'unscheduled' ? 'unscheduled' : fmtDate(date)} · ${n} statements · ${money(total)}`,
        module: 'Settlements',
        sev: 'Info',
      });
      setRunDate(null);
    });
  };

  const KPIS: readonly StatCardData[] = [
    {
      icon: 'landmark',
      label: 'Payable Now',
      value: moneyShort(payable.reduce((a, b) => a + b.net, 0)),
      sub: `${payable.length} statements pending release`,
      iconClass: 'bg-y-100 text-y-600',
      valueClass: 'text-y-600',
    },
    {
      icon: 'clock',
      label: 'Held in Advance',
      value: '₹ 4.2L',
      sub: 'upcoming bookings · payable after completion',
      iconClass: 'bg-blue-soft-bg text-blue',
      valueClass: 'text-blue',
    },
    {
      icon: 'circle-check',
      label: 'Released This Month',
      value: '₹ 9.8L',
      sub: '+8.2% vs last week',
      iconClass: 'bg-g-100 text-g-600',
      valueClass: 'text-g-600',
      subClass: 'text-g-600',
    },
    {
      icon: 'indian-rupee',
      label: 'Platform Earnings',
      value: '₹ 1.1L',
      sub: `${opsCommPct()} commission + cancellation fees`,
      iconClass: 'bg-blue-soft-bg text-text-navy',
      valueClass: 'text-text-navy',
    },
  ];

  const commCol = 'Commission (' + opsCommPct() + ')';
  const filtersActive =
    hospF !== 'All Hospitals' || statusF !== 'All' || dateF !== '' || dateT !== '';
  const clearAll = (): void => {
    setHospF('All Hospitals');
    setStatusF('All');
    setDateF('');
    setDateT('');
    setPage(0);
  };

  return (
    <div className="flex flex-col gap-5">
      <KpiStrip items={KPIS} />
      <Card pad={16} className="flex flex-wrap items-center gap-3">
        <SegTabs tabs={['By Payout Run', 'Flat List']} value={viewMode} onChange={setViewMode} />
        <FilterSelect
          value={hospF}
          aria-label="Filter by hospital"
          options={['All Hospitals', ...new Set(all.map((r) => hospName(r)))]}
          onChange={(v) => {
            setHospF(v);
            setPage(0);
          }}
        />
        <FilterSelect
          value={statusF === 'All' ? 'Status: All' : statusF}
          aria-label="Filter by settlement status"
          options={['All', 'Pending', 'Released', 'Received', 'Overdue', 'Payout failed'].map(
            (s) => (s === 'All' ? 'Status: All' : s),
          )}
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
          title="Expected from"
        />
        <SettlementDateInput
          value={dateT}
          onChange={(v) => {
            setDateT(v);
            setPage(0);
          }}
          title="Expected to"
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
          {payoutSched} payout runs · next: 20 Jun 2026
        </span>
      </Card>
      <div className="mx-0.5 flex items-center gap-2">
        <SectionTitle>Settlement Queue</SectionTitle>
        <InfoDot
          text={`Online booking fees are collected by Medibook at booking time and become payable to the hospital only after the appointment is completed. Pre-visit cancellations are refunded per the slab policy — Medibook keeps the cancellation fee. Statements are net of the ${opsCommPct()} platform commission (set in Platform Settings). Transfers themselves happen outside Medibook — releases here are the shared record of them.`}
        />
        <div className="flex-1"></div>
        <span className="text-caption text-grey-900">
          {filtered.length} statement{filtered.length === 1 ? '' : 's'} match
        </span>
      </div>
      {filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon="landmark"
            title={
              filtersActive ? 'No settlements match your filters.' : 'No settlement statements yet.'
            }
            message={
              filtersActive
                ? 'Try a wider expected-date range, or clear the filters to see every statement.'
                : 'Statements appear here once completed bookings are ready to pay out.'
            }
            {...(filtersActive ? { actionLabel: 'Clear filters', onAction: clearAll } : {})}
          />
        </Card>
      ) : viewMode === 'By Payout Run' ? (
        runs.map((g) => (
          <PayoutRunCard
            key={g.date}
            run={g}
            commCol={commCol}
            onOpenRun={(date) => {
              setRunRemark('');
              setRunDate(date);
            }}
            onOpenHosp={goHosp}
            onRelease={onRelease}
            onRetry={openRelease}
          />
        ))
      ) : (
        <Card>
          <TableShell
            columns={['Statement', 'Gross', commCol, 'Net Payable', 'Expected', 'Status', 'Action']}
            rightCols={['Gross', commCol, 'Net Payable']}
            sortKeys={{
              Statement: 'id',
              Gross: 'gross',
              [commCol]: 'commission',
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
                onRetry={openRelease}
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
      <RecordReleaseModal
        rel={rel}
        relBank={relBank}
        amt={relAmt}
        utrRef={relRef}
        remark={relRemark}
        err={relErr}
        busy={Boolean(busy.release)}
        onAmtChange={(v) => {
          setRelAmt(v);
          setRelErr((x) => ({ ...x, amt: null }));
        }}
        onRefChange={(v) => {
          setRelRef(v);
          setRelErr((x) => ({ ...x, ref: null }));
        }}
        onRemarkChange={setRelRemark}
        onClose={() => setReleaseId(null)}
        onRecord={recordRelease}
      />
      <RecordRunReleaseModal
        runTarget={runTarget}
        runRel={runRel}
        runSkip={runSkip}
        remark={runRemark}
        busy={Boolean(busy.runrel)}
        onRemarkChange={setRunRemark}
        onClose={() => setRunDate(null)}
        onRecord={doRunRelease}
      />
    </div>
  );
}
