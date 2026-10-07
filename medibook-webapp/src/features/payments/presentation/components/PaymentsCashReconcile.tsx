import { useState } from 'react';

import { isFailure } from '@/core/error/failure';

import { cn } from '@/shared/lib/cn';
import { fmtDate, money } from '@/shared/lib/format';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { ConfirmModal } from '@/shared/ui/ConfirmModal';
import { InfoDot } from '@/shared/ui/InfoDot';
import { SectionTitle } from '@/shared/ui/SectionTitle';
import { TableShell, tdClass } from '@/shared/ui/TableShell';
import type { TableStateSpec } from '@/shared/ui/TableState';
import { toast } from '@/shared/ui/toast/toast.store';

import type { CashSession } from '@/features/payments/domain/entities/payments.entities';
import { useCashDeskAccess } from '@/features/payments/application/queries/useCashDeskAccess';
import { useReconcileCashSessionMutation } from '@/features/payments/application/queries/useCashSessionMutations';
import { useCashSessionsToReconcileQuery } from '@/features/payments/application/queries/useCashSessionsToReconcileQuery';
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
        balance === 'balanced' && 'text-g-800',
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
 * counted and the variance; reconciling records that an admin checked it.
 * Drawers left open are auto-closed at 23:59 with no count and appear here as
 * “Not counted”.
 */
export function PaymentsCashReconcile() {
  const access = useCashDeskAccess();
  const list = useCashSessionsToReconcileQuery(access.canReconcile);
  const reconcile = useReconcileCashSessionMutation();
  const [confirming, setConfirming] = useState<CashSession | null>(null);

  if (!access.canReconcile) return null;

  const rows = list.data ?? [];
  const state: TableStateSpec | undefined = list.isPending
    ? { kind: 'loading', rows: 3 }
    : list.isLoadingError
      ? {
          kind: 'error',
          error: list.error,
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

  const confirmReconcile = (): void => {
    const session = confirming;
    setConfirming(null);
    if (!session) return;
    reconcile.mutate(session.id, {
      onSuccess: () => toast(`${session.staffName}’s drawer reconciled`, 'success'),
      onError: (failure) =>
        toast(
          isFailure(failure) ? failure.message : 'The drawer could not be reconciled.',
          'error',
          failure,
        ),
    });
  };

  return (
    <Card>
      <div className="mb-3.5 flex flex-wrap items-center gap-2">
        <SectionTitle>Cash drawers to reconcile</SectionTitle>
        <InfoDot text="Each front-desk drawer is closed with the cash counted. Check the variance against the day’s cash payments and refunds, then mark it reconciled. Drawers left open are closed automatically at 23:59 without a count." />
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
                {s.counterCode ? `Counter ${s.counterCode} · ` : ''}closed {clockCopy(s.closedAt)}
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
              <Button
                size="sm"
                variant="secondary"
                busy={reconcile.isPending && reconcile.variables === s.id}
                onClick={() => setConfirming(s)}
              >
                Reconcile
              </Button>
            </td>
          </tr>
        ))}
      </TableShell>
      <ConfirmModal
        open={confirming !== null}
        title="Mark this drawer reconciled?"
        body={
          confirming
            ? `${confirming.staffName}’s drawer for ${fmtDate(confirming.businessDate)} leaves the queue and is recorded as checked by you. Make sure any variance has been explained first.`
            : ''
        }
        confirmLabel="Reconcile"
        onClose={() => setConfirming(null)}
        onConfirm={confirmReconcile}
      />
    </Card>
  );
}
