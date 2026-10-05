import { useState } from 'react';

import { cn } from '@/shared/lib/cn';
import { money } from '@/shared/lib/format';
import { FormModal } from '@/shared/ui/FormModal';
import { Icon } from '@/shared/ui/Icon';
import { OpsField } from '@/shared/ui/OpsField';
import { TextInput } from '@/shared/ui/TextInput';
import { toast } from '@/shared/ui/toast/toast.store';

import { useReleasePayoutMutation } from '@/features/ops-settlements/application/queries/useReleasePayoutMutation';
import {
  bankLabel,
  failureText,
  type LedgerRow,
} from '@/features/ops-settlements/presentation/components/opsSettlements.viewModel';

interface RecordReleaseModalProps {
  /** The row being released; the modal is mounted only while one is picked. */
  rel: LedgerRow;
  onClose: () => void;
}

/**
 * Record Settlement Release (design single-statement release form) —
 * `POST /platform/settlements/payouts/{id}/release {utr_ref}`.
 *
 * The backend records the payout's full amount, so the amount is shown, not
 * edited; corrections are settlement adjustments, which this screen does not
 * create. On `FormModal`, so Enter records the release (audit 3.4.5).
 */
export function RecordReleaseModal({ rel, onClose }: RecordReleaseModalProps) {
  const release = useReleasePayoutMutation();
  const [utrRef, setUtrRef] = useState('');
  const [error, setError] = useState<string | null>(null);

  const summary: readonly [string, string, boolean?][] = [
    ['Hospital', rel.hospitalName],
    ['Period', rel.periodLabel],
    ['Payout run', rel.run?.runNo ?? '—', true],
    ['Net Payable', money(rel.payout?.amountRupees ?? rel.netRupees), true],
    ['Destination', bankLabel(rel.payout) ?? '—', true],
  ];

  const submit = (): void => {
    const payout = rel.payout;
    if (!payout) return;
    if (!utrRef.trim()) {
      setError('Enter the bank transfer reference.');
      return;
    }
    release.mutate(
      { payoutId: payout.id, utrRef: utrRef.trim() },
      {
        onSuccess: () => {
          toast(`Release recorded — visible to ${rel.hospitalName}.`, 'success');
          onClose();
        },
        onError: (failure) => setError(failureText(failure, 'Could not record the release.')),
      },
    );
  };

  return (
    <FormModal
      open
      onClose={onClose}
      title="Record Settlement Release"
      width={500}
      onSubmit={submit}
      submitLabel={release.isPending ? 'Recording…' : 'Record Release'}
      busy={release.isPending}
    >
      <div className="flex flex-col gap-4">
        <div className="bg-bg-subtle border-border flex flex-col gap-2 rounded-md border px-4 py-3">
          {summary.map(([k, v, num]) => (
            <div key={k} className="flex justify-between gap-3">
              <span className="text-caption text-text-muted">{k}</span>
              <span className={cn('text-body text-text-strong font-medium', num && 'tabular-nums')}>
                {v}
              </span>
            </div>
          ))}
        </div>
        <div className="text-caption text-text-muted bg-blue-soft-bg flex items-start gap-2 rounded-sm px-3 py-2.5">
          <Icon name="info" size={14} className="mt-px flex-none" /> The transfer itself happens
          outside Medibook (bank / NEFT / UPI). This records it on the shared ledger — the reference
          is visible to the hospital. The full net payable is recorded; amount corrections go
          through settlement adjustments.
        </div>
        <OpsField label="Transfer Reference (UTR)" required error={error}>
          <TextInput
            value={utrRef}
            name="utr"
            onChange={(v) => {
              setUtrRef(v);
              setError(null);
            }}
            height={48}
          />
        </OpsField>
      </div>
    </FormModal>
  );
}
