import { useState } from 'react';

import { fmtDate, money } from '@/shared/lib/format';
import { FormModal } from '@/shared/ui/FormModal';
import { Icon } from '@/shared/ui/Icon';
import { TextInput } from '@/shared/ui/TextInput';
import { toast } from '@/shared/ui/toast/toast.store';

import { useReleasePayoutRunMutation } from '@/features/ops-settlements/application/queries/useReleasePayoutRunMutation';
import {
  bankLabel,
  canReleaseTo,
  failureText,
  releaseBlocker,
  type RunGroup,
} from '@/features/ops-settlements/presentation/components/opsSettlements.viewModel';

interface RecordRunReleaseModalProps {
  /** A real run (never the unassigned group); mounted only while one is picked. */
  group: RunGroup;
  onClose: () => void;
}

/**
 * Record Run Release — `POST /platform/settlements/payout-runs/{id}/release`
 * with one transfer reference per payout, since each hospital's money moves
 * as its own bank transfer. Payouts without a verified payout account are
 * skipped (M-45): hold or fail them and pay them in a new run.
 * On `FormModal`, so Enter records the run (audit 3.4.5).
 */
export function RecordRunReleaseModal({ group, onClose }: RecordRunReleaseModalProps) {
  const release = useReleasePayoutRunMutation();
  const runRel = group.rows.filter((r) => r.releasable && canReleaseTo(r.payout));
  const runSkip = group.rows.filter((r) => r.releasable && !canReleaseTo(r.payout));
  const [utrs, setUtrs] = useState<Readonly<Record<string, string>>>({});
  const [error, setError] = useState<string | null>(null);

  const run = group.run;
  const title = run
    ? `Record Run Release · ${run.runNo}${run.scheduledFor ? ` · ${fmtDate(run.scheduledFor)}` : ''}`
    : 'Record Run Release';

  const submit = (): void => {
    if (!run) return;
    const releases = runRel.flatMap((r) =>
      r.payout ? [{ payoutId: r.payout.id, utrRef: (utrs[r.id] ?? '').trim() }] : [],
    );
    const missing = releases.filter((x) => x.utrRef === '').length;
    if (missing > 0) {
      setError(
        `Enter a transfer reference for all ${releases.length} payouts (${missing} missing).`,
      );
      return;
    }
    release.mutate(
      { runId: run.id, releases },
      {
        onSuccess: () => {
          const n = releases.length;
          toast(`Payout run recorded — ${n} settlement${n === 1 ? '' : 's'} released.`, 'success');
          onClose();
        },
        onError: (failure) => setError(failureText(failure, 'Could not record the payout run.')),
      },
    );
  };

  return (
    <FormModal
      open
      onClose={onClose}
      title={title}
      width={600}
      onSubmit={submit}
      submitLabel={
        release.isPending
          ? 'Recording…'
          : `Record ${runRel.length} Release${runRel.length === 1 ? '' : 's'}`
      }
      busy={release.isPending}
      disabled={release.isPending || runRel.length === 0}
    >
      <div className="flex flex-col gap-3.5">
        <div className="text-caption text-text-muted bg-blue-soft-bg flex items-start gap-2 rounded-sm px-3 py-2.5">
          <Icon name="info" size={14} className="mt-px flex-none" /> Transfers happen outside
          Medibook. This records the whole run on the shared ledger — one transfer reference per
          statement, visible to each hospital.
        </div>
        <div className="border-border-soft overflow-hidden rounded-md border">
          {runRel.map((r) => (
            <div
              key={r.id}
              className="border-border-soft flex items-center gap-3 border-b px-3.5 py-2.75"
            >
              <div className="min-w-0 flex-1">
                <div className="text-body text-text-strong font-medium">{r.hospitalName}</div>
                <div className="text-caption text-text-muted tabular-nums">
                  {r.periodLabel} · {bankLabel(r.payout) ?? '—'}
                </div>
              </div>
              <div className="w-40 flex-none">
                <TextInput
                  value={utrs[r.id] ?? ''}
                  name={`utr-${r.id}`}
                  aria-label={`Transfer reference (UTR) for ${r.hospitalName}`}
                  placeholder="UTR"
                  onChange={(v) => {
                    setUtrs((u) => ({ ...u, [r.id]: v }));
                    setError(null);
                  }}
                />
              </div>
              <span className="text-body text-text-strong flex-none font-medium tabular-nums">
                {money(r.payout?.amountRupees ?? r.netRupees)}
              </span>
            </div>
          ))}
          <div className="bg-bg-tint text-body text-text-navy flex justify-between px-3.5 py-3 font-medium">
            <span>Total to release</span>
            <span className="tabular-nums">
              {money(runRel.reduce((a, r) => a + (r.payout?.amountRupees ?? r.netRupees), 0))}
            </span>
          </div>
        </div>
        {error && (
          <div className="text-caption text-d-700 bg-d-100 flex items-start gap-2 rounded-sm px-3 py-2.5">
            <Icon name="triangle-alert" size={14} className="mt-px flex-none" /> {error}
          </div>
        )}
        {runSkip.length > 0 && (
          <div className="text-caption text-y-700 bg-y-100 flex items-start gap-2 rounded-sm px-3 py-2.5">
            <Icon name="triangle-alert" size={14} className="mt-px flex-none" /> Skipped:{' '}
            {runSkip
              .map((r) => `${r.hospitalName} (${releaseBlocker(r.payout) ?? 'not payable'})`)
              .join(', ')}
            . Hold or fail those payouts from the statement, then pay them in a new run once the
            account is verified.
          </div>
        )}
      </div>
    </FormModal>
  );
}
