import { hospName } from '@/features/ops-hospitals/application/store/hospitals.store';
import type { Bank } from '@/features/ops-hospitals/application/store/hospitals.types';
import { cn } from '@/shared/lib/cn';
import { money } from '@/shared/lib/format';
import { FormModal } from '@/shared/ui/FormModal';
import { Icon } from '@/shared/ui/Icon';
import { OpsField } from '@/shared/ui/OpsField';
import { TextInput } from '@/shared/ui/TextInput';

import type { RelErr, SettlementRow } from './settlement-model';

interface RecordReleaseModalProps {
  rel: SettlementRow | undefined;
  relBank: Bank | null;
  amt: string;
  utrRef: string;
  remark: string;
  err: RelErr;
  busy: boolean;
  onAmtChange: (value: string) => void;
  onRefChange: (value: string) => void;
  onRemarkChange: (value: string) => void;
  onClose: () => void;
  onRecord: () => void;
}

/**
 * Record Settlement Release modal (design single-statement release form),
 * on `FormModal` so Enter records the release (audit 3.4.5).
 */
export function RecordReleaseModal({
  rel,
  relBank,
  amt,
  utrRef,
  remark,
  err,
  busy,
  onAmtChange,
  onRefChange,
  onRemarkChange,
  onClose,
  onRecord,
}: RecordReleaseModalProps) {
  const summary: readonly [string, string, boolean?][] = rel
    ? [
        ['Statement', rel.id, true],
        ['Hospital', hospName(rel)],
        ['Period', rel.period],
        ['Net Payable', money(rel.net), true],
        [
          'Destination',
          relBank ? `${relBank.bank} ····${String(relBank.account).slice(-4)}` : '—',
          true,
        ],
      ]
    : [];
  return (
    <FormModal
      open={!!rel}
      onClose={onClose}
      title="Record Settlement Release"
      width={500}
      onSubmit={onRecord}
      submitLabel={busy ? 'Recording…' : 'Record Release'}
      busy={busy}
    >
      {rel && (
        <div className="flex flex-col gap-4">
          <div className="bg-bg-subtle border-border flex flex-col gap-2 rounded-md border px-4 py-3">
            {summary.map(([k, v, num]) => (
              <div key={k} className="flex justify-between gap-3">
                <span className="text-caption text-text-muted">{k}</span>
                <span
                  className={cn('text-body text-text-strong font-medium', num && 'tabular-nums')}
                >
                  {v}
                </span>
              </div>
            ))}
          </div>
          <div className="text-caption text-text-muted bg-blue-soft-bg flex items-start gap-2 rounded-sm px-3 py-2.5">
            <Icon name="info" size={14} className="mt-px flex-none" /> The transfer itself happens
            outside Medibook (bank / NEFT / UPI). This records it on the shared ledger — the
            reference and remark are visible to the hospital.
          </div>
          <div className="grid grid-cols-2 gap-4">
            <OpsField label="Amount Released (₹)" required error={err.amt}>
              <TextInput
                value={amt}
                name="releasedAmount"
                inputMode="numeric"
                onChange={onAmtChange}
                height={48}
              />
            </OpsField>
            <OpsField label="Transfer Reference (UTR)" required error={err.ref}>
              <TextInput value={utrRef} name="utr" onChange={onRefChange} height={48} />
            </OpsField>
          </div>
          <OpsField label="Remark (visible to the hospital)">
            {(field) => (
              <textarea
                id={field.id}
                value={remark}
                onChange={(e) => onRemarkChange(e.target.value)}
                placeholder="e.g. Part release — balance follows after dispute review"
                className="border-border rounded-input text-body-lg text-text-strong h-18 w-full resize-none border p-3"
              ></textarea>
            )}
          </OpsField>
        </div>
      )}
    </FormModal>
  );
}
