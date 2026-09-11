import { useCallback, useState } from 'react';

import { SETTLE_COMMISSION } from '@/core/config/demo';
import type { SortAccessors } from '@/shared/hooks/useSort';
import { useSort } from '@/shared/hooks/useSort';
import { cn } from '@/shared/lib/cn';
import { downloadCsv } from '@/shared/lib/download';
import { fmtDate, money, moneyShort } from '@/shared/lib/format';
import { dateRange } from '@/shared/lib/validate';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { ClearChip } from '@/shared/ui/ClearChip';
import { Icon } from '@/shared/ui/Icon';
import { InfoDot } from '@/shared/ui/InfoDot';
import { KpiStrip } from '@/shared/ui/KpiStrip';
import { Modal } from '@/shared/ui/Modal';
import { Pager } from '@/shared/ui/Pager';
import { RefreshBtn } from '@/shared/ui/RefreshBtn';
import { SectionTitle } from '@/shared/ui/SectionTitle';
import { SegTabs } from '@/shared/ui/SegTabs';
import { SkeletonKpiStrip } from '@/shared/ui/Skeleton';
import type { StatCardData } from '@/shared/ui/StatCard';
import { TableShell, tdClass } from '@/shared/ui/TableShell';
import type { TableStateSpec } from '@/shared/ui/TableState';
import { toast } from '@/shared/ui/toast/toast.store';

import { useAppointmentsStore } from '@/features/appointments/application/store/appointments.store';
import { useSettlementsStore } from '@/features/settlements/application/store/settlements.store';
import type { Settlement } from '@/features/settlements/application/store/settlements.types';
import { PlanBilling } from '@/features/settlements/presentation/components/PlanBilling';

/** Platform commission as a display percentage (design `SETTLE_PCT`). */
const SETTLE_PCT = `${Math.round(SETTLE_COMMISSION * 100)}%`;

const PAGE = 7;

/** Appointment states whose fee will never be settled. */
const DEAD_STATUSES: readonly string[] = ['Cancelled', 'No-show'];

/** Which action a confirm dialog is driving. */
type ConfirmAction = 'received' | 'raise' | 'request';

interface ConfirmState {
  readonly row: Settlement;
  readonly action: ConfirmAction;
}

/** Sort accessors for the settlement records table (design `ACC`). */
const ACC: SortAccessors<Settlement> = {
  period: (r) => r.expected,
  gross: (r) => r.gross,
  commission: (r) => r.commission,
  net: (r) => r.net,
  expected: (r) => r.expected,
  status: (r) => r.status,
};

const SETTLEMENT_COLUMNS = [
  'Settlement Period',
  'Gross Amount',
  'Commission',
  'Net Payable',
  'Expected Date',
  'Status',
  'Action',
] as const;

const SORT_KEYS: Readonly<Record<string, string>> = {
  'Settlement Period': 'period',
  'Gross Amount': 'gross',
  Commission: 'commission',
  'Net Payable': 'net',
  'Expected Date': 'expected',
  Status: 'status',
};

/** Billing & Settlements (admin) — settlement ledger + Plan & Billing tab. */
export function SettlementsScreen() {
  const settlements = useSettlementsStore((s) => s.settlements);
  const settleMarkReceived = useSettlementsStore((s) => s.settleMarkReceived);
  const settleRequest = useSettlementsStore((s) => s.settleRequest);
  const appts = useAppointmentsStore((s) => s.appts);

  const [tab, setTab] = useState('Settlements');
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [q, setQ] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const { sort, onSort, sorted } = useSort<Settlement>();

  /**
   * Re-derive the ledger from the store. There is no settlements API yet, so
   * the refresh re-emits the live store state — every row and KPI is rebuilt
   * from it — and this is where the refetch goes when that API lands.
   */
  const refresh = useCallback(async (): Promise<void> => {
    setLoading(true);
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    useSettlementsStore.setState((s) => ({ settlements: [...s.settlements] }));
    setLoading(false);
  }, []);

  const rangeError = from !== '' && to !== '' ? dateRange(from, to) : undefined;

  const filtered = settlements.filter((r) => {
    if (q && !(r.id + r.period + r.status).toLowerCase().includes(q.toLowerCase())) return false;
    if (from && r.expected < from) return false;
    if (to && r.expected > to) return false;
    return true;
  });
  const sum = (list: readonly Settlement[]): number => list.reduce((a, r) => a + r.net, 0);
  const total = sum(settlements);
  const received = sum(settlements.filter((r) => r.status === 'Received'));
  const overdue = settlements.filter((r) => r.status === 'Overdue');

  // Fees Medibook has collected for appointments that have not completed yet:
  // prepaid online bookings still in the queue. Derived from the appointments
  // store rather than printed as a fixed figure, so the tile cannot claim a
  // number the app cannot back up.
  const heldGross = appts
    .filter(
      (a) =>
        a.source === 'Online' &&
        a.payment === 'Paid' &&
        !DEAD_STATUSES.includes(a.status) &&
        a.status !== 'Completed',
    )
    .reduce((s, a) => s + a.amount, 0);
  const heldNet = heldGross - Math.round(heldGross * SETTLE_COMMISSION);

  const KPIS: readonly StatCardData[] = [
    {
      icon: 'wallet',
      label: 'Total Settlement Amount',
      value: moneyShort(total),
      sub: `${settlements.length} statements`,
      iconClass: 'bg-blue-soft-bg text-blue',
      valueClass: 'text-blue',
    },
    {
      icon: 'circle-check',
      label: 'Received Amount',
      value: moneyShort(received),
      sub: `${total ? Math.round((received / total) * 100) : 0}% of total`,
      iconClass: 'bg-g-100 text-g-600',
      valueClass: 'text-g-600',
    },
    {
      icon: 'triangle-alert',
      label: 'Overdue Settlements',
      value: money(sum(overdue)),
      sub: `${overdue.length} settlement${overdue.length === 1 ? '' : 's'}`,
      iconClass: 'bg-d-100 text-d-500',
      valueClass: 'text-d-500',
    },
    {
      icon: 'clock',
      label: 'Held by Medibook (Upcoming)',
      value: money(heldNet),
      sub: 'prepaid online bookings still to complete',
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
  if (loading) tableState = { kind: 'loading', rows: 5 };
  else if (rows.length === 0)
    tableState = {
      kind: 'empty',
      icon: 'scale',
      title: filtersActive ? 'No settlements match your filters.' : 'No settlements yet.',
      message: filtersActive
        ? 'Widen the expected-date range or clear the search.'
        : 'Weekly statements appear here once Medibook has collected online booking fees.',
      actionLabel: filtersActive ? 'Clear filters' : undefined,
      onAction: filtersActive ? clearFilters : undefined,
    };

  /** Real CSV file — RFC-4180 escaping and a UTF-8 BOM so Excel renders ₹. */
  const exportCsv = (): void => {
    downloadCsv('medibook-settlements.csv', [
      [
        'Statement',
        'Period',
        'Gross',
        'Commission %',
        'Commission',
        'Net Payable',
        'Expected',
        'Status',
        'Transfer Ref',
        'Received On',
      ],
      ...filtered.map((r) => [
        r.id,
        r.period,
        r.gross,
        SETTLE_PCT,
        r.commission,
        r.net,
        fmtDate(r.expected),
        r.status,
        r.utr ?? '—',
        fmtDate(r.receivedOn),
      ]),
    ]);
    toast('Exported medibook-settlements.csv', 'success');
  };

  const doConfirm = (): void => {
    if (!confirm) return;
    if (confirm.action === 'received') settleMarkReceived(confirm.row.id);
    else settleRequest(confirm.row.id, confirm.action);
    setConfirm(null);
  };

  return (
    <div className="flex flex-col gap-5">
      <Card pad={16} className="flex flex-wrap items-center justify-between gap-3">
        <SegTabs tabs={['Settlements', 'Plan & Billing']} value={tab} onChange={setTab} />
        {tab === 'Settlements' && (
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

      {tab === 'Plan & Billing' ? (
        <PlanBilling />
      ) : (
        <>
          {loading ? <SkeletonKpiStrip count={KPIS.length} /> : <KpiStrip items={KPIS} />}
          <Card pad={16} className="flex flex-wrap items-center gap-3.5">
            <span className="text-body text-text-muted">Expected between</span>
            <input
              type="date"
              value={from}
              aria-label="Expected on or after"
              aria-invalid={rangeError ? true : undefined}
              onChange={(e) => onFilter(setFrom)(e.target.value)}
              className="border-border text-body text-text-body h-11 rounded-md border px-3.5"
            />
            <span className="text-body text-text-muted">and</span>
            <input
              type="date"
              value={to}
              aria-label="Expected on or before"
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
              <InfoDot
                text={`Medibook collects online booking fees upfront, keeps a ${SETTLE_PCT} commission, and transfers the net amount to the hospital by the expected date. Fees become payable only after the appointment is completed — pre-visit cancellations are refunded to the patient per Medibook's slab policy. Mark a transfer Received once it reaches your account.`}
              />{' '}
              {SETTLE_PCT} platform commission applies
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
                  aria-label="Search settlements by statement, date or status"
                  placeholder="Search by statement, date or status"
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
                    {r.period}
                    <div className="text-caption text-text-muted font-normal">{r.id}</div>
                    {r.remark && (
                      <div className="text-caption text-blue mt-0.5 font-normal">
                        “{r.remark}” — Medibook
                      </div>
                    )}
                  </td>
                  <td className={cn(tdClass, 'text-right tabular-nums')}>{money(r.gross)}</td>
                  <td className={cn(tdClass, 'text-right tabular-nums')}>
                    {money(r.commission)}
                    <div className="text-caption text-text-muted">{SETTLE_PCT}</div>
                  </td>
                  <td
                    className={cn(
                      tdClass,
                      'text-text-strong text-right font-semibold tabular-nums',
                    )}
                  >
                    {money(r.net)}
                    {r.releasedAmt && r.releasedAmt !== r.net ? (
                      <div className="text-caption text-y-700 font-normal">
                        released {money(r.releasedAmt)}
                      </div>
                    ) : null}
                  </td>
                  <td className={tdClass}>{fmtDate(r.expected)}</td>
                  <td className={tdClass}>
                    <Badge status={r.status} />
                    {r.utr && (
                      <div className="text-caption text-text-muted mt-1 tabular-nums">{r.utr}</div>
                    )}
                  </td>
                  <td className={tdClass}>
                    {r.status === 'Received' ? (
                      <span className="text-caption text-g-600 inline-flex items-center gap-1.25">
                        <Icon name="check" size={15} /> {fmtDate(r.receivedOn)}
                      </span>
                    ) : r.status === 'Released' ? (
                      <Button
                        size="sm"
                        variant="success"
                        icon="check-check"
                        onClick={() => setConfirm({ row: r, action: 'received' })}
                      >
                        Mark Received
                      </Button>
                    ) : r.status === 'Payout failed' ? (
                      <span className="text-caption text-d-500">
                        Payout failed · Medibook is retrying
                      </span>
                    ) : r.status === 'Overdue' ? (
                      r.requested ? (
                        <span className="text-caption text-y-700">
                          Follow-up raised · awaiting Medibook
                        </span>
                      ) : (
                        <Button
                          size="sm"
                          variant="secondary"
                          icon="triangle-alert"
                          onClick={() => setConfirm({ row: r, action: 'raise' })}
                        >
                          Raise a request
                        </Button>
                      )
                    ) : r.requested ? (
                      <span className="text-caption text-blue">Requested · awaiting Medibook</span>
                    ) : (
                      <Button
                        size="sm"
                        icon="send"
                        onClick={() => setConfirm({ row: r, action: 'request' })}
                      >
                        Request
                      </Button>
                    )}
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
                  Net due: {money(sum(filtered.filter((r) => r.status !== 'Received')))}
                </span>
              }
            />
          </Card>
        </>
      )}

      <Modal
        open={!!confirm}
        onClose={() => setConfirm(null)}
        width={440}
        title={
          confirm?.action === 'raise'
            ? 'Raise Settlement Request'
            : confirm?.action === 'received'
              ? 'Confirm Transfer Received'
              : 'Request Settlement'
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant={confirm?.action === 'received' ? 'success' : 'primary'}
              icon={confirm?.action === 'received' ? 'check' : 'send'}
              onClick={doConfirm}
            >
              {confirm?.action === 'received'
                ? 'Mark Received'
                : confirm?.action === 'raise'
                  ? 'Raise Request'
                  : 'Send Request'}
            </Button>
          </>
        }
      >
        <p className="text-body-lg text-text-body m-0 mb-3">
          {confirm?.action === 'received' ? (
            <>
              Confirm the hospital has received the bank transfer for <b>{confirm?.row.id}</b>.
            </>
          ) : confirm?.action === 'raise' ? (
            <>
              This settlement is <b>overdue</b>. Raise a follow-up request with Medibook for{' '}
              <b>{confirm?.row.id}</b>.
            </>
          ) : (
            <>
              Request Medibook to release the settlement for <b>{confirm?.row.id}</b>.
            </>
          )}
        </p>
        {confirm && (
          <div className="bg-blue-soft-bg rounded-lg p-4.5 text-center">
            <div className="text-caption text-text-muted">
              {confirm.row.period} · net of {SETTLE_PCT} commission
            </div>
            <div className="text-stat text-blue tabular-nums">
              {money(confirm.row.releasedAmt || confirm.row.net)}
            </div>
            {confirm.row.releasedAmt && confirm.row.releasedAmt !== confirm.row.net && (
              <div className="text-caption text-y-700">
                partial release · statement net {money(confirm.row.net)}
              </div>
            )}
            <div className="text-caption text-text-muted">
              Expected by {fmtDate(confirm.row.expected)}
            </div>
            {confirm.row.utr && (
              <div className="text-caption text-text-strong mt-1 tabular-nums">
                Transfer ref: {confirm.row.utr}
              </div>
            )}
            {confirm.row.remark && (
              <div className="text-caption text-text-body mt-1">
                “{confirm.row.remark}” — Medibook
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
