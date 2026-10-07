import { useState } from 'react';

import { cn } from '@/shared/lib/cn';
import { money } from '@/shared/lib/format';
import { Field } from '@/shared/ui/Field';
import { FormModal } from '@/shared/ui/FormModal';
import { TextInput } from '@/shared/ui/TextInput';
import { toast } from '@/shared/ui/toast/toast.store';

import { useCloseCashSessionMutation } from '@/features/payments/application/queries/useCashSessionMutations';
import {
  cashWriteFailureCopy,
  drawerBalance,
  paiseToRupees,
  rupeesToPaise,
} from '@/features/payments/presentation/components/payments.view';

const NOTE_MAX_CHARS = 1000;

/** What closing a drawer needs to know about it. */
export interface ClosableDrawer {
  readonly id: string;
  /** Sent as `If-Match` (B2); `null` on an older backend. */
  readonly version: number | null;
  readonly staffName: string;
  readonly openingFloatPaise: number;
  readonly expectedCashPaise: number;
  /** The signed-in member's own drawer (anyone else's needs `cash_desk.del`). */
  readonly isOwn: boolean;
}

interface PaymentsCloseDrawerModalProps {
  /** The open drawer being closed. */
  session: ClosableDrawer;
  onClose: () => void;
}

/**
 * Close a cash drawer with the cash actually counted (D-28). The server keeps
 * the expected amount and records the variance; this previews it so the staff
 * member can recount or leave a note for the admin before closing.
 *
 * Mounted per open: the replay key is minted once, so a retry after a lost
 * answer replays the close instead of failing (B2), and the drawer's version
 * rides as `If-Match` so a stale screen cannot close a changed drawer.
 */
export function PaymentsCloseDrawerModal({ session, onClose }: PaymentsCloseDrawerModalProps) {
  const close = useCloseCashSessionMutation();
  // One key per close action: a retry of the same count and note reuses it.
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const renewKey = (): void => setIdempotencyKey(crypto.randomUUID());
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
      {
        id: session.id,
        countedCashPaise: counted,
        note: note.trim() || null,
        guard: { version: session.version, idempotencyKey },
      },
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
          setError(cashWriteFailureCopy(failure, 'The drawer could not be closed.'));
        },
      },
    );
  };

  return (
    <FormModal
      open
      onClose={onClose}
      title={session.isOwn ? 'Close your cash drawer' : `Close ${session.staffName}’s drawer`}
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
              renewKey();
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
              balance === 'balanced' && 'bg-g-100 text-g-700',
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
            onChange={(v) => {
              setNote(v);
              renewKey();
            }}
            maxLength={NOTE_MAX_CHARS}
            placeholder="e.g. ₹50 change given from personal cash"
            height={48}
          />
        </Field>
      </div>
    </FormModal>
  );
}
