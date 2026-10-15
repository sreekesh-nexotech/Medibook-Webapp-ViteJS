import { useState } from 'react';

import { fmtDate, money } from '@/shared/lib/format';
import { FormModal } from '@/shared/ui/FormModal';
import { Icon } from '@/shared/ui/Icon';
import { OpsField } from '@/shared/ui/OpsField';
import { toast } from '@/shared/ui/toast/toast.store';

import { useCreatePayoutRunMutation } from '@/features/ops-settlements/application/queries/useCreatePayoutRunMutation';
import {
  failureText,
  runSkipLabel,
  type LedgerRow,
} from '@/features/ops-settlements/presentation/components/opsSettlements.viewModel';
import { SettlementDateInput } from '@/features/ops-settlements/presentation/components/SettlementDateInput';

interface OpsSettlementsCreateRunModalProps {
  /** The closed, unpaid periods the run will pick up. */
  rows: readonly LedgerRow[];
  /** The smallest window covering them. */
  window: { readonly start: string; readonly end: string };
  hospitalName: (id: string) => string | null;
  onClose: () => void;
}

/**
 * Create Payout Run — `POST /platform/settlements/payout-runs`. The backend
 * gathers every closed, unpaid period with a positive net inside the window
 * into a draft run, which is then approved and released from its card. Only
 * hospitals whose primary payout account platform finance has verified are
 * paid (M-45); the others come back as `skipped` and are named here.
 */
export function OpsSettlementsCreateRunModal({
  rows,
  window,
  hospitalName,
  onClose,
}: OpsSettlementsCreateRunModalProps) {
  const create = useCreatePayoutRunMutation();
  const [scheduledFor, setScheduledFor] = useState('');
  const [error, setError] = useState<string | null>(null);
  const total = rows.reduce((a, r) => a + r.netRupees, 0);

  const submit = (): void =>
    create.mutate(
      {
        periodStart: window.start,
        periodEnd: window.end,
        scheduledFor: scheduledFor || null,
        notes: null,
      },
      {
        onSuccess: ({ run, skipped }) => {
          toast(`Payout run ${run.runNo} created as a draft — approve it to release.`, 'success');
          if (skipped.length > 0) {
            toast(
              `Left out of ${run.runNo}: ${skipped
                .map(
                  (s) =>
                    `${hospitalName(s.hospitalId) ?? 'a hospital'} (${runSkipLabel(s.reason)})`,
                )
                .join(', ')}. Verify the payout account, then create another run.`,
              'info',
            );
          }
          onClose();
        },
        onError: (failure) => setError(failureText(failure, 'Could not create the payout run.')),
      },
    );

  return (
    <FormModal
      open
      onClose={onClose}
      title="Create Payout Run"
      width={500}
      onSubmit={submit}
      submitLabel={create.isPending ? 'Creating…' : 'Create Draft Run'}
      busy={create.isPending}
    >
      <div className="flex flex-col gap-4">
        <div className="bg-bg-subtle border-border flex flex-col gap-2 rounded-md border px-4 py-3">
          <div className="flex justify-between gap-3">
            <span className="text-caption text-text-muted">Window</span>
            <span className="text-body text-text-strong font-medium">
              {fmtDate(window.start)} – {fmtDate(window.end)}
            </span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-caption text-text-muted">Statements</span>
            <span className="text-body text-text-strong font-medium tabular-nums">
              {rows.length} · net {money(total)}
            </span>
          </div>
        </div>
        <div className="text-caption text-text-muted bg-blue-soft-bg flex items-start gap-2 rounded-sm px-3 py-2.5">
          <Icon name="info" size={14} className="mt-px flex-none" /> Every closed, unpaid statement
          in this window with something to pay joins the run — for every hospital, whatever the
          queue&apos;s filters. Hospitals without a verified payout account are left out. The run
          starts as a draft; someone approves it, then each transfer is recorded.
        </div>
        <OpsField label="Scheduled transfer date (optional)" error={error}>
          <SettlementDateInput
            value={scheduledFor}
            onChange={(v) => {
              setScheduledFor(v);
              setError(null);
            }}
            title="Scheduled transfer date"
          />
        </OpsField>
      </div>
    </FormModal>
  );
}
