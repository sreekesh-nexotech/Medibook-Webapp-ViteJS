import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { isFailure } from '@/core/error/failure';

import { useOpsPermission } from '@/shared/hooks/useOpsPermission';
import { cn } from '@/shared/lib/cn';
import { fmtDate, money } from '@/shared/lib/format';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Drawer } from '@/shared/ui/Drawer';
import { ErrorState } from '@/shared/ui/ErrorState';
import { InfoGrid } from '@/shared/ui/InfoGrid';
import { OpsConfirm } from '@/shared/ui/OpsConfirm';
import { OpsField } from '@/shared/ui/OpsField';
import { SectionTitle } from '@/shared/ui/SectionTitle';
import { SegTabs } from '@/shared/ui/SegTabs';
import { SkeletonCards } from '@/shared/ui/Skeleton';
import { TextInput } from '@/shared/ui/TextInput';
import { toast } from '@/shared/ui/toast/toast.store';

import { opsHospitalDetailPath } from '@/app/router/paths';

import { useAddAdjustmentMutation } from '@/features/ops-settlements/application/queries/useAddAdjustmentMutation';
import { usePayoutCommandMutation } from '@/features/ops-settlements/application/queries/usePayoutCommandMutation';
import { useSettlementPeriodQuery } from '@/features/ops-settlements/application/queries/useSettlementPeriodQuery';
import type {
  Payout,
  PayoutCommand,
  SettlementPeriodDetail,
} from '@/features/ops-settlements/domain/entities/opsSettlements.entities';
import {
  bankLabel,
  breakdownLines,
  datePart,
  failureText,
  isReconciled,
  parseAdjustmentAmount,
  releaseBlocker,
  type LedgerRow,
} from '@/features/ops-settlements/presentation/components/opsSettlements.viewModel';

const REASON_MAX = 2000;
const CREDIT = 'Add to payable';
const DEBIT = 'Deduct from payable';

const PAYOUT_STATUS_LABEL: Readonly<Record<Payout['status'], readonly [string, string]>> = {
  pending: ['Pending', 'Pending'],
  released: ['Released', 'Released'],
  failed: ['Payout failed', 'Failed'],
  on_hold: ['On Hold', 'On hold'],
};

const PERIOD_STATUS_LABEL: Readonly<Record<string, string>> = {
  closed: 'Closed — payable',
  paid: 'Paid',
  on_hold: 'On hold',
  open: 'Open',
};

interface PeriodDrawerProps {
  row: LedgerRow;
  /** Open the Statements tab (statements need `billing.view`). */
  onOpenStatements: (() => void) | null;
  onClose: () => void;
}

/**
 * One settlement statement (UAT-37, 09·R2-R4): the live ledger breakdown with
 * the reconciliation of its frozen net (BE-27), its adjustments and a form to
 * post one (Idempotency-Key per form), its payout with Hold / Fail, and the
 * monthly statements it overlaps.
 */
export function PeriodDrawer({ row, onOpenStatements, onClose }: PeriodDrawerProps) {
  const navigate = useNavigate();
  const query = useSettlementPeriodQuery(row.id);
  const detail = query.data;

  return (
    <Drawer
      open
      onClose={onClose}
      title={row.hospitalName}
      subtitle={`Statement · ${row.periodLabel}`}
      width={620}
      footer={
        <div className="flex flex-wrap justify-end gap-3">
          <Button
            variant="secondary"
            onClick={() => navigate(opsHospitalDetailPath(row.hospitalId))}
          >
            Open hospital
          </Button>
        </div>
      }
    >
      {query.isPending ? (
        <SkeletonCards count={2} lines={5} />
      ) : query.isError || !detail ? (
        <ErrorState
          inline
          title="This statement didn't load"
          message={failureText(query.error, 'Please try again.')}
          onRetry={() => void query.refetch()}
        />
      ) : (
        <PeriodDetailBody detail={detail} onOpenStatements={onOpenStatements} />
      )}
    </Drawer>
  );
}

interface PeriodDetailBodyProps {
  detail: SettlementPeriodDetail;
  onOpenStatements: (() => void) | null;
}

function PeriodDetailBody({ detail, onOpenStatements }: PeriodDetailBodyProps) {
  const canEdit = useOpsPermission().can('settlements.edit');
  const { period, breakdown, payout } = detail;
  const reconciled = breakdown
    ? isReconciled(breakdown, period.adjustmentsRupees, period.tdsRupees, period.netPayableRupees)
    : null;

  return (
    <div className="flex flex-col gap-6">
      <InfoGrid
        items={[
          { k: 'Status', v: PERIOD_STATUS_LABEL[period.status] ?? period.status },
          { k: 'Net payable', v: money(period.netPayableRupees), num: true },
          { k: 'Closed', v: detail.closedAt ? fmtDate(datePart(detail.closedAt)) : '—' },
        ]}
      />

      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <SectionTitle>Breakdown</SectionTitle>
          {reconciled !== null && (
            <Badge status={reconciled ? 'Active' : 'Overdue'}>
              {reconciled ? 'Reconciled' : 'Does not reconcile'}
            </Badge>
          )}
        </div>
        {breakdown ? (
          <>
            <dl className="border-border-soft m-0 flex flex-col rounded-md border">
              {breakdownLines(
                breakdown,
                period.adjustmentsRupees,
                period.tdsRupees,
                period.netPayableRupees,
              ).map((line) => (
                <div
                  key={line.label}
                  className={cn(
                    'border-border-soft flex justify-between gap-3 border-b px-3.5 py-2.5 last:border-b-0',
                    line.strong && 'bg-bg-tint',
                  )}
                >
                  <dt className={cn('text-body', line.strong ? 'font-medium' : 'text-text-muted')}>
                    {line.label}
                  </dt>
                  <dd
                    className={cn(
                      'text-body m-0 tabular-nums',
                      line.strong ? 'text-text-strong font-medium' : 'text-text-body',
                    )}
                  >
                    {money(line.rupees)}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="text-caption text-text-muted m-0">
              {breakdown.bookingsCount} booking{breakdown.bookingsCount === 1 ? '' : 's'} ·{' '}
              {breakdown.entries} ledger entr{breakdown.entries === 1 ? 'y' : 'ies'}
              {breakdown.lateEntries > 0
                ? ` · ${breakdown.lateEntries} journalled after an earlier close and rolled in`
                : ''}
              . Convenience fees ({money(breakdown.convenienceFeesRupees)} + GST{' '}
              {money(breakdown.convenienceFeeGstRupees)}) are Medibook&apos;s and are not part of
              the payable.
              {reconciled === false && breakdown.differenceRupees !== null
                ? ` The frozen net differs from the ledger by ${money(breakdown.differenceRupees)} — raise it with engineering before paying.`
                : ''}
            </p>
          </>
        ) : (
          <p className="text-body text-text-muted m-0">No breakdown is available.</p>
        )}
      </section>

      <AdjustmentsSection detail={detail} canEdit={canEdit} />

      <PayoutSection payout={payout} canEdit={canEdit} />

      <section className="flex flex-col gap-2">
        <SectionTitle>Monthly statements</SectionTitle>
        {detail.statements.length === 0 ? (
          <p className="text-body text-text-muted m-0">
            No monthly statement covering these dates has been issued yet.
          </p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
            {detail.statements.map((s) => (
              <li key={s.id} className="text-body flex flex-wrap items-center gap-2">
                <span className="text-text-strong font-medium tabular-nums">{s.statementNo}</span>
                <span className="text-text-muted">
                  {fmtDate(s.periodStart)} – {fmtDate(s.periodEnd)}
                  {s.id === detail.statementId ? ' · the month this statement starts in' : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
        {onOpenStatements && detail.statements.length > 0 && (
          <div>
            <Button size="sm" variant="ghost" onClick={onOpenStatements}>
              Open Statements
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}

function AdjustmentsSection({
  detail,
  canEdit,
}: {
  detail: SettlementPeriodDetail;
  canEdit: boolean;
}) {
  const add = useAddAdjustmentMutation();
  const [direction, setDirection] = useState(CREDIT);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<{ amount?: string; reason?: string; form?: string }>({});
  const paid = detail.period.status === 'paid' || detail.payout?.status === 'released';

  const submit = (): void => {
    const rupees = parseAdjustmentAmount(amount);
    const next: typeof errors = {};
    if (rupees === undefined) next.amount = 'Enter an amount above ₹0 with at most two decimals.';
    if (!reason.trim()) next.reason = 'Say why — the hospital sees this on its statement.';
    setErrors(next);
    if (rupees === undefined || next.reason) return;
    add.mutate(
      {
        hospitalId: detail.period.hospitalId,
        settlementPeriodId: detail.period.id,
        amountRupees: direction === CREDIT ? rupees : -rupees,
        reason: reason.trim(),
      },
      {
        onSuccess: (adj) => {
          setAmount('');
          setReason('');
          toast(
            adj.carriedForward
              ? 'Adjustment posted. This statement is already paid, so it settles in the next closed period.'
              : 'Adjustment posted. The net payable was recalculated; an approved run goes back to draft.',
            'success',
          );
        },
        onError: (failure) => {
          const amountError = isFailure(failure)
            ? failure.fieldErrors.amount_paise?.[0]
            : undefined;
          const reasonError = isFailure(failure) ? failure.fieldErrors.reason?.[0] : undefined;
          setErrors({
            ...(amountError ? { amount: amountError } : {}),
            ...(reasonError ? { reason: reasonError } : {}),
            ...(amountError || reasonError
              ? {}
              : { form: failureText(failure, 'The adjustment was not posted.') }),
          });
        },
      },
    );
  };

  return (
    <section className="flex flex-col gap-3">
      <SectionTitle>Adjustments</SectionTitle>
      {detail.adjustments.length === 0 ? (
        <p className="text-body text-text-muted m-0">No adjustments on this statement.</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {detail.adjustments.map((a) => (
            <li
              key={a.id}
              className="border-border-soft flex items-start justify-between gap-3 rounded-md border px-3.5 py-2.5"
            >
              <div className="min-w-0">
                <div className="text-body text-text-strong">{a.reason}</div>
                <div className="text-caption text-text-muted">
                  {fmtDate(datePart(a.createdAt))}
                  {a.carriedForward ? ' · carried to the next closed period' : ''}
                </div>
              </div>
              <span
                className={cn(
                  'text-body flex-none font-medium tabular-nums',
                  a.amountRupees < 0 ? 'text-d-700' : 'text-g-600',
                )}
              >
                {money(a.amountRupees)}
              </span>
            </li>
          ))}
        </ul>
      )}
      {canEdit && (
        <div className="bg-bg-subtle border-border flex flex-col gap-3 rounded-md border p-3.5">
          <SegTabs
            tabs={[CREDIT, DEBIT]}
            value={direction}
            onChange={setDirection}
            ariaLabel="Adjustment direction"
          />
          <div className="grid gap-3 sm:grid-cols-3">
            <OpsField label="Amount (₹)" required error={errors.amount}>
              <TextInput
                value={amount}
                onChange={(v) => {
                  setAmount(v);
                  setErrors({});
                }}
                inputMode="decimal"
                placeholder="e.g. 250"
                height={44}
              />
            </OpsField>
            <div className="sm:col-span-2">
              <OpsField label="Reason" required error={errors.reason}>
                <TextInput
                  value={reason}
                  onChange={(v) => {
                    setReason(v.slice(0, REASON_MAX));
                    setErrors({});
                  }}
                  placeholder="e.g. Goodwill credit for a disputed refund"
                  height={44}
                />
              </OpsField>
            </div>
          </div>
          {errors.form && <div className="text-caption text-d-700">{errors.form}</div>}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-caption text-text-muted">
              {paid
                ? 'This statement is paid: the adjustment lands in the next closed period.'
                : 'The net payable is recalculated; an approved run goes back to draft.'}
            </span>
            <Button size="sm" busy={add.isPending} onClick={submit}>
              Post Adjustment
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

function PayoutSection({ payout, canEdit }: { payout: Payout | null; canEdit: boolean }) {
  const command = usePayoutCommandMutation();
  const [action, setAction] = useState<PayoutCommand | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!payout) {
    return (
      <section className="flex flex-col gap-2">
        <SectionTitle>Payout</SectionTitle>
        <p className="text-body text-text-muted m-0">
          Not in a payout run yet. Create a run over these dates from the queue.
        </p>
      </section>
    );
  }

  const [badge, label] = PAYOUT_STATUS_LABEL[payout.status];
  const canHold = payout.status === 'pending';
  const canFail = payout.status === 'pending' || payout.status === 'on_hold';
  const blocker = releaseBlocker(payout);

  const closeDialog = (): void => {
    setAction(null);
    setReason('');
    setError(null);
  };

  const confirm = (): void => {
    if (!action) return;
    if (!reason.trim()) {
      setError('Give a reason — it is kept on the payout.');
      return;
    }
    command.mutate(
      { payoutId: payout.id, command: action, reason: reason.trim() },
      {
        onSuccess: () => {
          toast(action === 'hold' ? 'Payout put on hold.' : 'Payout marked failed.', 'success');
          closeDialog();
        },
        onError: (failure) => setError(failureText(failure, 'The payout was not changed.')),
      },
    );
  };

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <SectionTitle>Payout</SectionTitle>
        <Badge status={badge}>{label}</Badge>
      </div>
      <InfoGrid
        items={[
          { k: 'Amount', v: money(payout.amountRupees), num: true },
          { k: 'Payout run', v: payout.runNo ?? '—', num: true },
          {
            k: 'Account',
            v: `${bankLabel(payout) ?? 'None on file'}${blocker ? ` · ${blocker}` : ''}`,
          },
          { k: 'UTR', v: payout.utrRef ?? '—', num: Boolean(payout.utrRef) },
          {
            k: 'Released',
            v: payout.releasedAt ? fmtDate(datePart(payout.releasedAt)) : '—',
          },
          { k: 'Note', v: payout.failureReason ?? payout.notes ?? '—' },
        ]}
      />
      {canEdit && (canHold || canFail) && (
        <div className="flex flex-wrap gap-3">
          {canHold && (
            <Button size="sm" variant="secondary" icon="pause" onClick={() => setAction('hold')}>
              Hold Payout
            </Button>
          )}
          {canFail && (
            <Button size="sm" variant="ghost" icon="ban" onClick={() => setAction('fail')}>
              Mark Failed
            </Button>
          )}
        </div>
      )}
      <OpsConfirm
        open={action !== null}
        onClose={closeDialog}
        icon={action === 'fail' ? 'ban' : 'pause'}
        tone={action === 'fail' ? 'danger' : 'warning'}
        title={action === 'fail' ? 'Mark this payout failed?' : 'Put this payout on hold?'}
        body={
          action === 'fail'
            ? 'Use this when the bank returned the transfer or it cannot be made. The statement can then be paid in a new run.'
            : 'The payout stays in its run but is not released until it is released again from here or the run.'
        }
        confirmLabel={
          command.isPending ? 'Saving…' : action === 'fail' ? 'Mark Failed' : 'Hold Payout'
        }
        confirmVariant={action === 'fail' ? 'danger' : 'primary'}
        busy={command.isPending}
        onConfirm={confirm}
      >
        <OpsField label="Reason" required error={error}>
          <TextInput
            value={reason}
            onChange={(v) => {
              setReason(v.slice(0, REASON_MAX));
              setError(null);
            }}
            placeholder={
              action === 'fail' ? 'e.g. Account closed — returned by bank' : 'e.g. KYC check'
            }
            height={44}
          />
        </OpsField>
      </OpsConfirm>
    </section>
  );
}
