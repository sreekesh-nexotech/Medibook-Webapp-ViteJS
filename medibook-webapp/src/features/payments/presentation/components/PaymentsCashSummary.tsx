import { isFailure } from '@/core/error/failure';
import { cn } from '@/shared/lib/cn';
import { money, todayISO } from '@/shared/lib/format';
import { Card } from '@/shared/ui/Card';
import { InfoDot } from '@/shared/ui/InfoDot';
import { SectionTitle } from '@/shared/ui/SectionTitle';
import { TableShell, tdClass } from '@/shared/ui/TableShell';
import type { TableStateSpec } from '@/shared/ui/TableState';

import type { CashSummaryRow } from '@/features/payments/domain/entities/payments.entities';
import { useCashDeskAccess } from '@/features/payments/application/queries/useCashDeskAccess';
import { useCashSummaryQuery } from '@/features/payments/application/queries/useCashSummaryQuery';
import {
  drawerBalance,
  paiseToRupees,
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

const LOADING_ROWS = 2;

function rupees(paise: number): string {
  return money(paiseToRupees(paise));
}

function varianceCell(row: CashSummaryRow) {
  if (row.variancePaise === null) {
    return (
      <span className="text-text-muted">
        {row.openSessions > 0 ? 'Drawer open' : 'Not counted'}
      </span>
    );
  }
  const balance = drawerBalance(row.variancePaise);
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
        : `${balance === 'short' ? '−' : '+'}${rupees(Math.abs(row.variancePaise))}`}
    </span>
  );
}

/**
 * Today's cash per staff member (`GET /cash-sessions/summary`, v2 §5.6): the
 * float each drawer started with, cash taken and handed back, what the drawer
 * should hold and what was counted. Shown to admins, who reconcile drawers;
 * it is the day-level view the "to reconcile" list checks one drawer at a time.
 */
export function PaymentsCashSummary() {
  const access = useCashDeskAccess();
  const today = todayISO();
  const summary = useCashSummaryQuery(today, access.canReconcile);

  if (!access.canReconcile) return null;

  const rows = summary.data ?? [];
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
            title: 'No cash drawers today.',
            message: 'Drawers appear here once staff open them for the day.',
          }
        : undefined;

  return (
    <Card>
      <div className="mb-3.5 flex flex-wrap items-center gap-2">
        <SectionTitle>Today’s cash summary</SectionTitle>
        <InfoDot text="Per staff member, across all of today’s drawers: the opening float, cash taken and refunded, what the drawers should hold and what was counted at close. Open drawers have no count yet." />
      </div>
      <TableShell
        columns={COLUMNS}
        rightCols={['Float', 'Cash in', 'Cash refunds', 'Expected', 'Counted', 'Variance']}
        state={state}
        scrollLabel="Today's cash summary"
      >
        {rows.map((r) => (
          <tr key={r.staffId}>
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
        ))}
      </TableShell>
    </Card>
  );
}
