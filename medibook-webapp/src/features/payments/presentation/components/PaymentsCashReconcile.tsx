import { useState } from 'react';

import { isFailure } from '@/core/error/failure';

import { cn } from '@/shared/lib/cn';
import { fmtDate, money } from '@/shared/lib/format';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { InfoDot } from '@/shared/ui/InfoDot';
import { SectionTitle } from '@/shared/ui/SectionTitle';
import { TableShell, tdClass } from '@/shared/ui/TableShell';
import type { TableStateSpec } from '@/shared/ui/TableState';

import type { CashSession } from '@/features/payments/domain/entities/payments.entities';
import { useCashDeskAccess } from '@/features/payments/application/queries/useCashDeskAccess';
import { useCashSessionsToReconcileQuery } from '@/features/payments/application/queries/useCashSessionsToReconcileQuery';
import { PaymentsDrawerActivityModal } from '@/features/payments/presentation/components/PaymentsDrawerActivityModal';
import { PaymentsReconcileModal } from '@/features/payments/presentation/components/PaymentsReconcileModal';
import {
  clockCopy,
  drawerBalance,
  paiseToRupees,
} from '@/features/payments/presentation/components/payments.view';

const COLUMNS = ['Staff', 'Day', 'Expected', 'Counted', 'Variance', 'Note', ''] as const;

function varianceCell(session: CashSession) {
  if (session.variancePaise === null) {
    return <span className="text-text-muted">Not counted</span>;
  }
  const balance = drawerBalance(session.variancePaise);
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
        : `${balance === 'short' ? '−' : '+'}${money(paiseToRupees(Math.abs(session.variancePaise)))}`}
    </span>
  );
}

/**
 * Closed cash drawers waiting for an admin (`cash_desk.del` = reconcile,
 * D-28). Each row shows what the server expected, what the staff member
 * counted and the variance, and opens the drawer's own cash payments and
 * refunds to explain it (UAT-72). Reconciling records the admin's check and a
 * note; a drawer the 23:59 job closed without a count is given the cash
 * actually found in it (BE-23).
 */
export function PaymentsCashReconcile() {
  const access = useCashDeskAccess();
  const list = useCashSessionsToReconcileQuery(access.canReconcile);
  const [reconciling, setReconciling] = useState<CashSession | null>(null);
  const [inspecting, setInspecting] = useState<CashSession | null>(null);

  if (!access.canReconcile) return null;

  const rows = list.data ?? [];
  const state: TableStateSpec | undefined = list.isPending
    ? { kind: 'loading', rows: 3 }
    : list.isError
      ? {
          kind: 'error',
          title: 'Cash drawers didn’t load',
          message: isFailure(list.error) ? list.error.message : undefined,
          onRetry: () => void list.refetch(),
        }
      : rows.length === 0
        ? {
            kind: 'empty',
            icon: 'banknote',
            title: 'Nothing to reconcile.',
            message: 'Every closed cash drawer has been checked.',
          }
        : undefined;

  return (
    <Card>
      <div className="mb-3.5 flex flex-wrap items-center gap-2">
        <SectionTitle>Cash drawers to reconcile</SectionTitle>
        <InfoDot text="Each front-desk drawer is closed with the cash counted. Open a drawer’s payments to check the variance against its cash payments and refunds, then mark it reconciled. Drawers left open are closed automatically at 23:59 without a count — enter the cash you find when you reconcile them." />
        <span className="flex-1" />
        {list.data && (
          <span className="text-caption text-text-muted tabular-nums">{rows.length} waiting</span>
        )}
      </div>
      <TableShell
        columns={COLUMNS}
        rightCols={['Expected', 'Counted', 'Variance']}
        state={state}
        scrollLabel="Cash drawers to reconcile"
      >
        {rows.map((s) => (
          <tr key={s.id}>
            <td className={cn(tdClass, 'text-text-strong font-medium')}>
              {s.staffName}
              <div className="text-caption text-text-muted font-normal">
                {s.counterCode ? `Counter ${s.counterCode} · ` : ''}
                {s.isAutoClosed
                  ? `closed automatically ${clockCopy(s.closedAt)}`
                  : `closed ${clockCopy(s.closedAt)}${
                      s.closedByName && s.closedByName !== s.staffName
                        ? ` by ${s.closedByName}`
                        : ''
                    }`}
              </div>
            </td>
            <td className={cn(tdClass, 'whitespace-nowrap')}>{fmtDate(s.businessDate)}</td>
            <td className={cn(tdClass, 'text-right tabular-nums')}>
              {money(paiseToRupees(s.expectedCashPaise))}
            </td>
            <td className={cn(tdClass, 'text-right tabular-nums')}>
              {s.countedCashPaise === null ? '—' : money(paiseToRupees(s.countedCashPaise))}
            </td>
            <td className={cn(tdClass, 'text-right')}>{varianceCell(s)}</td>
            <td className={cn(tdClass, 'max-w-70')}>
              <span className="text-text-muted">{s.closeNote || '—'}</span>
            </td>
            <td className={tdClass}>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="ghost" icon="eye" onClick={() => setInspecting(s)}>
                  Payments
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setReconciling(s)}>
                  Reconcile
                </Button>
              </div>
            </td>
          </tr>
        ))}
      </TableShell>
      {reconciling && (
        <PaymentsReconcileModal
          key={reconciling.id}
          session={reconciling}
          onClose={() => setReconciling(null)}
        />
      )}
      {inspecting && (
        <PaymentsDrawerActivityModal
          drawer={{
            id: inspecting.id,
            businessDate: inspecting.businessDate,
            staffName: inspecting.staffName,
            counterCode: inspecting.counterCode,
          }}
          onClose={() => setInspecting(null)}
        />
      )}
    </Card>
  );
}
