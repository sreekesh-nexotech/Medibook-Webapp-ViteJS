import { useState } from 'react';

import { cn } from '@/shared/lib/cn';
import { fmtDate, money } from '@/shared/lib/format';
import { Field } from '@/shared/ui/Field';
import { FormModal } from '@/shared/ui/FormModal';
import { TextInput } from '@/shared/ui/TextInput';
import { toast } from '@/shared/ui/toast/toast.store';

import type { CashSession } from '@/features/payments/domain/entities/payments.entities';
import { useReconcileCashSessionMutation } from '@/features/payments/application/queries/useCashSessionMutations';
import {
  cashWriteFailureCopy,
  drawerBalance,
  paiseToRupees,
  rupeesToPaise,
} from '@/features/payments/presentation/components/payments.view';

const NOTE_MAX_CHARS = 1000;

interface PaymentsReconcileModalProps {
  /** The closed drawer being reconciled. */
  session: CashSession;
  onClose: () => void;
}

/**
 * Reconcile one closed drawer (`POST /cash-sessions/{id}/reconcile`, BE-23).
 * A drawer counted at close keeps that count; one the 23:59 job closed with
 * no count is given the cash actually found, and the variance follows. The
 * note records what the admin checked. `If-Match` and a replay key minted per
 * open guard the write (B2).
 */
export function PaymentsReconcileModal({ session, onClose }: PaymentsReconcileModalProps) {
  const reconcile = useReconcileCashSessionMutation();
  // One key per reconcile action: a retry of the same count and note reuses it.
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const renewKey = (): void => setIdempotencyKey(crypto.randomUUID());
  const [countedText, setCountedText] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const needsCount = session.countedCashPaise === null;
  const counted = needsCount ? rupeesToPaise(countedText) : session.countedCashPaise;
  const variance = counted === null ? null : counted - session.expectedCashPaise;
  const balance = variance === null ? null : drawerBalance(variance);

  const submit = (): void => {
    if (needsCount && countedText.trim() !== '' && counted === null) {
      setError('Enter the cash found, for example 1250 or 1250.50.');
      return;
    }
    reconcile.mutate(
      {
        id: session.id,
        countedCashPaise: needsCount ? counted : null,
        note: note.trim() || null,
        guard: { version: session.version, idempotencyKey },
      },
      {
        onSuccess: () => {
          toast(`${session.staffName}’s drawer reconciled`, 'success');
          onClose();
        },
        onError: (failure) =>
          setError(cashWriteFailureCopy(failure, 'The drawer could not be reconciled.')),
      },
    );
  };

  return (
    <FormModal
      open
      onClose={onClose}
      title={`Reconcile ${session.staffName}’s drawer`}
      width={520}
      onSubmit={submit}
      submitLabel="Mark reconciled"
      busy={reconcile.isPending}
    >
      <div className="flex flex-col gap-4">
        <p className="text-body text-text-body m-0">
          {fmtDate(session.businessDate)}
          {session.counterCode ? ` · Counter ${session.counterCode}` : ''}. The drawer leaves the
          queue and is recorded as checked by you. Explain any variance first.
        </p>
        <div className="bg-bg-subtle grid grid-cols-3 gap-3 rounded-md px-3.5 py-3">
          <div className="flex flex-col">
            <span className="text-caption text-text-muted">Opening float</span>
            <span className="text-body text-text-strong font-medium tabular-nums">
              {money(paiseToRupees(session.openingFloatPaise))}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-caption text-text-muted">Expected</span>
            <span className="text-body text-text-strong font-medium tabular-nums">
              {money(paiseToRupees(session.expectedCashPaise))}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-caption text-text-muted">Counted at close</span>
            <span className="text-body text-text-strong font-medium tabular-nums">
              {needsCount ? 'Not counted' : money(paiseToRupees(session.countedCashPaise ?? 0))}
            </span>
          </div>
        </div>
        {session.closeNote && (
          <div className="text-caption text-text-body">Note at close: “{session.closeNote}”</div>
        )}
        {needsCount && (
          <Field
            label="Cash found in the drawer (₹)"
            hint={
              session.isAutoClosed
                ? 'This drawer was closed automatically at 23:59 without a count. Count it now; leave blank if it cannot be counted.'
                : 'Nobody counted this drawer at close. Count it now, or leave blank.'
            }
            error={error}
          >
            <TextInput
              value={countedText}
              onChange={(v) => {
                setCountedText(v);
                setError(null);
                renewKey();
              }}
              inputMode="decimal"
              placeholder="e.g. 1250"
              height={48}
              autoFocus
            />
          </Field>
        )}
        {variance !== null && balance !== null && (
          <div
            className={cn(
              'text-body rounded-md px-3.5 py-2.5',
              balance === 'balanced' && 'bg-g-100 text-g-700',
              balance === 'short' && 'bg-d-100 text-d-700',
              balance === 'over' && 'bg-y-100 text-y-800',
            )}
          >
            {balance === 'balanced'
              ? 'The drawer balances.'
              : `${balance === 'short' ? 'Short' : 'Over'} by ${money(paiseToRupees(Math.abs(variance)))}.`}
          </div>
        )}
        <Field
          label="Reconcile note"
          hint="Optional. What you checked, and how any difference was explained."
          error={needsCount ? undefined : error}
        >
          <TextInput
            value={note}
            onChange={(v) => {
              setNote(v);
              renewKey();
            }}
            maxLength={NOTE_MAX_CHARS}
            placeholder="e.g. ₹50 short — change given from personal cash, confirmed"
            height={48}
          />
        </Field>
      </div>
    </FormModal>
  );
}
