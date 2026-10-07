import { Fragment, useState } from 'react';

import { isFailure } from '@/core/error/failure';
import { cn } from '@/shared/lib/cn';
import { fmtDate, money } from '@/shared/lib/format';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { ClearChip } from '@/shared/ui/ClearChip';
import { InfoDot } from '@/shared/ui/InfoDot';
import { SectionTitle } from '@/shared/ui/SectionTitle';
import { TableShell, tdClass } from '@/shared/ui/TableShell';
import type { TableStateSpec } from '@/shared/ui/TableState';

import type {
  CashSummaryDrawer,
  CashSummaryRow,
} from '@/features/payments/domain/entities/payments.entities';
import { useCashDeskAccess } from '@/features/payments/application/queries/useCashDeskAccess';
import { useCashSummaryQuery } from '@/features/payments/application/queries/useCashSummaryQuery';
import {
  type ClosableDrawer,
  PaymentsCloseDrawerModal,
} from '@/features/payments/presentation/components/PaymentsCloseDrawerModal';
import {
  type DrawerActivityTarget,
  PaymentsDrawerActivityModal,
} from '@/features/payments/presentation/components/PaymentsDrawerActivityModal';
import {
  clockCopy,
  drawerBalance,
  paiseToRupees,
  summaryVariance,
} from '@/features/payments/presentation/components/payments.view';

const COLUMNS = [
  'Staff',
  'Float',
  'Cash in',
  'Cash refunds',
  'Expected',
  'Counted',
  'Variance',
] as const;

const RIGHT_COLUMNS = ['Float', 'Cash in', 'Cash refunds', 'Expected', 'Counted', 'Variance'];

const LOADING_ROWS = 2;

const DATE_INPUT_CLASS =
  'rounded-input border-border text-body text-text-body h-10 border bg-white px-3';

function rupees(paise: number): string {
  return money(paiseToRupees(paise));
}

function VarianceText({ variancePaise }: { variancePaise: number }) {
  const balance = drawerBalance(variancePaise);
  return (
    <span
      className={cn(
        'font-medium tabular-nums',
        balance === 'balanced' && 'text-g-700',
        balance === 'short' && 'text-d-700',
        balance === 'over' && 'text-y-800',
      )}
    >
      {balance === 'balanced'
        ? 'Balanced'
        : `${balance === 'short' ? '−' : '+'}${rupees(Math.abs(variancePaise))}`}
    </span>
  );
}

function varianceCell(row: CashSummaryRow) {
  const variance = summaryVariance(row);
  if (variance === null) {
    return (
      <span className="text-text-muted">
        {row.openSessions > 0 ? 'Drawer open' : 'Not counted'}
      </span>
    );
  }
  return (
    <span className="flex flex-col items-end">
      <VarianceText variancePaise={variance} />
      {row.uncountedSessions > 0 && (
        <span className="text-caption text-text-muted">counted drawers only</span>
      )}
    </span>
  );
}

/**
 * The day's cash per staff member (`GET /cash-sessions/summary`, v2 §5.6):
 * the float each drawer started with, cash taken and handed back, what the
 * drawers should hold and what was counted. Shown to everyone who handles a
 * drawer (UAT-72): overseers (admin, accountant) see every drawer; everyone
 * else sees only their own (the backend decides, BE-23). Each drawer opens
 * its own cash payments and refunds; an admin may close a colleague's drawer
 * left open (B2: owner or `cash_desk.del`).
 */
export function PaymentsCashSummary() {
  const access = useCashDeskAccess();
  // Blank = the hospital's own today (the server's, not the device's, F26).
  const [date, setDate] = useState('');
  const summary = useCashSummaryQuery(date === '' ? null : date, access.canView);
  const [inspecting, setInspecting] = useState<DrawerActivityTarget | null>(null);
  const [closing, setClosing] = useState<ClosableDrawer | null>(null);

  if (!access.canView) return null;

  const data = summary.data;
  const rows = data?.rows ?? [];
  const isOwn = data?.scope === 'own';
  const dayLabel = date === '' ? 'Today' : fmtDate(date);
  const state: TableStateSpec | undefined = summary.isPending
    ? { kind: 'loading', rows: LOADING_ROWS }
    : summary.isError
      ? {
          kind: 'error',
          title: 'The cash summary didn’t load',
          message: isFailure(summary.error) ? summary.error.message : undefined,
          onRetry: () => void summary.refetch(),
        }
      : rows.length === 0
        ? {
            kind: 'empty',
            icon: 'banknote',
            title: isOwn ? 'You had no cash drawer on this day.' : 'No cash drawers on this day.',
            message: 'Drawers appear here once staff open them for the day.',
          }
        : undefined;

  const drawerRow = (row: CashSummaryRow, d: CashSummaryDrawer) => {
    const isMine = row.staffId === access.staffId;
    const mayClose = d.status === 'open' && !isMine && access.canReconcile;
    return (
      <tr key={d.id} className="bg-bg-subtle">
        <td className={cn(tdClass, 'pl-8')}>
          <div className="text-caption text-text-body">
            {d.counterCode ? `Counter ${d.counterCode}` : 'Drawer'} · opened {clockCopy(d.openedAt)}
            {d.status === 'open'
              ? ' · open'
              : d.isAutoClosed
                ? ' · closed automatically'
                : ` · closed ${clockCopy(d.closedAt)}`}
          </div>
          <div className="mt-1 flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="ghost"
              icon="eye"
              onClick={() =>
                setInspecting({
                  id: d.id,
                  businessDate: data?.date ?? date,
                  staffName: row.staffName,
                  counterCode: d.counterCode,
                })
              }
            >
              Payments
            </Button>
            {mayClose && (
              <Button
                size="sm"
                variant="ghost"
                icon="lock"
                onClick={() =>
                  setClosing({
                    id: d.id,
                    version: d.version,
                    staffName: row.staffName,
                    openingFloatPaise: d.openingFloatPaise,
                    expectedCashPaise: d.expectedCashPaise,
                    isOwn: false,
                  })
                }
              >
                Close for {row.staffName}
              </Button>
            )}
          </div>
        </td>
        <td className={cn(tdClass, 'text-caption text-right tabular-nums')}>
          {rupees(d.openingFloatPaise)}
        </td>
        <td className={cn(tdClass, 'text-caption text-right tabular-nums')}>
          {rupees(d.cashInPaise)}
        </td>
        <td className={cn(tdClass, 'text-caption text-right tabular-nums')}>
          {d.cashRefundsPaise > 0 ? `−${rupees(d.cashRefundsPaise)}` : rupees(0)}
        </td>
        <td className={cn(tdClass, 'text-caption text-right tabular-nums')}>
          {rupees(d.expectedCashPaise)}
        </td>
        <td className={cn(tdClass, 'text-caption text-right tabular-nums')}>
          {d.countedCashPaise === null ? '—' : rupees(d.countedCashPaise)}
        </td>
        <td className={cn(tdClass, 'text-caption text-right')}>
          {d.variancePaise === null ? (
            <span className="text-text-muted">{d.status === 'open' ? 'Open' : 'Not counted'}</span>
          ) : (
            <VarianceText variancePaise={d.variancePaise} />
          )}
        </td>
      </tr>
    );
  };

  return (
    <Card>
      <div className="mb-3.5 flex flex-wrap items-center gap-2">
        <SectionTitle>
          {isOwn ? 'Your cash' : 'Cash summary'} · {dayLabel}
        </SectionTitle>
        <InfoDot
          text={
            isOwn
              ? 'Your own drawers for the day: the opening float, cash taken and refunded, what the drawer should hold and what was counted at close.'
              : 'Per staff member, across the day’s drawers: the opening float, cash taken and refunded, what the drawers should hold and what was counted at close. Open drawers have no count yet; the variance covers counted drawers only.'
          }
        />
        <span className="flex-1" />
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          aria-label="Cash summary day"
          title="Cash summary day"
          className={DATE_INPUT_CLASS}
        />
        {date !== '' && <ClearChip label="Today" onClick={() => setDate('')} />}
      </div>
      <TableShell
        columns={COLUMNS}
        rightCols={RIGHT_COLUMNS}
        state={state}
        scrollLabel="Cash summary"
      >
        {rows.map((r) => (
          <Fragment key={r.staffId}>
            <tr>
              <td className={cn(tdClass, 'text-text-strong font-medium')}>
                {r.staffName}
                <div className="text-caption text-text-muted font-normal">
                  {r.counters.length > 0 ? `Counter ${r.counters.join(', ')}` : 'No counter'}
                  {r.openSessions > 0 ? ' · drawer open' : ''}
                </div>
              </td>
              <td className={cn(tdClass, 'text-right tabular-nums')}>
                {rupees(r.openingFloatPaise)}
              </td>
              <td className={cn(tdClass, 'text-right tabular-nums')}>{rupees(r.cashInPaise)}</td>
              <td className={cn(tdClass, 'text-right tabular-nums')}>
                {r.cashRefundsPaise > 0 ? `−${rupees(r.cashRefundsPaise)}` : rupees(0)}
              </td>
              <td className={cn(tdClass, 'text-right tabular-nums')}>
                {rupees(r.expectedCashPaise)}
              </td>
              <td className={cn(tdClass, 'text-right tabular-nums')}>
                {r.countedCashPaise === null ? '—' : rupees(r.countedCashPaise)}
              </td>
              <td className={cn(tdClass, 'text-right')}>{varianceCell(r)}</td>
            </tr>
            {r.drawers.map((d) => drawerRow(r, d))}
          </Fragment>
        ))}
        {data?.totals && rows.length > 1 && (
          <tr>
            <td className={cn(tdClass, 'text-text-strong font-semibold')}>Day total</td>
            <td className={cn(tdClass, 'text-right font-semibold tabular-nums')}>
              {rupees(data.totals.openingFloatPaise)}
            </td>
            <td className={cn(tdClass, 'text-right font-semibold tabular-nums')}>
              {rupees(data.totals.cashInPaise)}
            </td>
            <td className={cn(tdClass, 'text-right font-semibold tabular-nums')}>
              {data.totals.cashRefundsPaise > 0
                ? `−${rupees(data.totals.cashRefundsPaise)}`
                : rupees(0)}
            </td>
            <td className={cn(tdClass, 'text-right font-semibold tabular-nums')}>
              {rupees(data.totals.expectedCashPaise)}
            </td>
            <td className={tdClass} />
            <td className={tdClass} />
          </tr>
        )}
      </TableShell>
      {inspecting && (
        <PaymentsDrawerActivityModal drawer={inspecting} onClose={() => setInspecting(null)} />
      )}
      {closing && (
        <PaymentsCloseDrawerModal
          key={closing.id}
          session={closing}
          onClose={() => setClosing(null)}
        />
      )}
    </Card>
  );
}
