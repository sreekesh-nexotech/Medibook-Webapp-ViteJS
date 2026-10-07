import { useState } from 'react';

import { isFailure } from '@/core/error/failure';

import { cn } from '@/shared/lib/cn';
import { money } from '@/shared/lib/format';
import { Field } from '@/shared/ui/Field';
import { FormModal } from '@/shared/ui/FormModal';
import { TextInput } from '@/shared/ui/TextInput';
import { toast } from '@/shared/ui/toast/toast.store';

import type { CashSession } from '@/features/payments/domain/entities/payments.entities';
import { useCloseCashSessionMutation } from '@/features/payments/application/queries/useCashSessionMutations';
import {
  drawerBalance,
  paiseToRupees,
  rupeesToPaise,
} from '@/features/payments/presentation/components/payments.view';

const NOTE_MAX_CHARS = 1000;

interface PaymentsCloseDrawerModalProps {
  /** The open drawer being closed. */
  session: CashSession;
  onClose: () => void;
}

/**
 * Close a cash drawer with the cash actually counted (D-28). The server keeps
 * the expected amount and records the variance; this previews it so the staff
 * member can recount or leave a note for the admin before closing.
 */
export function PaymentsCloseDrawerModal({ session, onClose }: PaymentsCloseDrawerModalProps) {
  const close = useCloseCashSessionMutation();
  const [countedText, setCountedText] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const counted = rupeesToPaise(countedText);
  const variance = counted === null ? null : counted - session.expectedCashPaise;
  const balance = variance === null ? null : drawerBalance(variance);

  const submit = (): void => {
    if (counted === null) {
      setError('Enter the cash you counted, for example 1250 or 1250.50.');
      return;
    }
    close.mutate(
      { id: session.id, countedCashPaise: counted, note: note.trim() || null },
      {
        onSuccess: (closed) => {
          const v = closed.variancePaise ?? 0;
          toast(
            v === 0
              ? 'Drawer closed. It balances.'
              : `Drawer closed ${v < 0 ? 'short' : 'over'} by ${money(paiseToRupees(Math.abs(v)))}`,
            v === 0 ? 'success' : 'info',
          );
          onClose();
        },
        onError: (failure) => {
          setError(isFailure(failure) ? failure.message : 'The drawer could not be closed.');
        },
      },
    );
  };

  return (
    <FormModal
      open
      onClose={onClose}
      title="Close your cash drawer"
      width={520}
      onSubmit={submit}
      submitLabel="Close drawer"
      busy={close.isPending}
    >
      <div className="flex flex-col gap-4">
        <div className="bg-bg-subtle grid grid-cols-2 gap-3 rounded-md px-3.5 py-3">
          <div className="flex flex-col">
            <span className="text-caption text-text-muted">Opening float</span>
            <span className="text-body text-text-strong font-medium tabular-nums">
              {money(paiseToRupees(session.openingFloatPaise))}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-caption text-text-muted">Expected in drawer</span>
            <span className="text-body text-text-strong font-medium tabular-nums">
              {money(paiseToRupees(session.expectedCashPaise))}
            </span>
          </div>
        </div>
        <Field label="Cash counted (₹)" required error={error}>
          <TextInput
            value={countedText}
            onChange={(v) => {
              setCountedText(v);
              setError(null);
            }}
            inputMode="decimal"
            placeholder="Count the notes and coins in the drawer"
            height={48}
            autoFocus
          />
        </Field>
        {variance !== null && balance !== null && (
          <div
            className={cn(
              'text-body rounded-md px-3.5 py-2.5',
              balance === 'balanced' && 'bg-g-100 text-g-800',
              balance === 'short' && 'bg-d-100 text-d-700',
              balance === 'over' && 'bg-y-100 text-y-800',
            )}
          >
            {balance === 'balanced'
              ? 'The drawer balances.'
              : `${balance === 'short' ? 'Short' : 'Over'} by ${money(paiseToRupees(Math.abs(variance)))}. Recount, or leave a note for the admin.`}
          </div>
        )}
        <Field label="Note for the admin" hint="Optional. Explain any difference.">
          <TextInput
            value={note}
            onChange={setNote}
            maxLength={NOTE_MAX_CHARS}
            placeholder="e.g. ₹50 change given from personal cash"
            height={48}
          />
        </Field>
      </div>
    </FormModal>
  );
}
