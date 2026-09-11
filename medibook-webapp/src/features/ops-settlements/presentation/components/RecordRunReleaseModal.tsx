import { bankOf, hospName } from '@/features/ops-hospitals/application/store/hospitals.store';
import { fmtDate, money } from '@/shared/lib/format';
import { FormModal } from '@/shared/ui/FormModal';
import { Icon } from '@/shared/ui/Icon';
import { OpsField } from '@/shared/ui/OpsField';

import type { PayoutRun, SettlementRow } from './settlement-model';

interface RecordRunReleaseModalProps {
  runTarget: PayoutRun | null;
  runRel: readonly SettlementRow[];
  runSkip: readonly SettlementRow[];
  remark: string;
  busy: boolean;
  onRemarkChange: (value: string) => void;
  onClose: () => void;
  onRecord: () => void;
}

/**
 * Record Run Release modal — per-statement list, total, skipped warning.
 * On `FormModal`, so Enter records the run (audit 3.4.5).
 */
export function RecordRunReleaseModal({
  runTarget,
  runRel,
  runSkip,
  remark,
  busy,
  onRemarkChange,
  onClose,
  onRecord,
}: RecordRunReleaseModalProps) {
  const disabled = busy || runRel.length === 0;
  const title = runTarget
    ? `Record Run Release · ${runTarget.date === 'unscheduled' ? 'Unscheduled' : fmtDate(runTarget.date)}`
    : 'Record Run Release';
  return (
    <FormModal
      open={!!runTarget}
      onClose={onClose}
      title={title}
      width={600}
      onSubmit={onRecord}
      submitLabel={
        busy ? 'Recording…' : `Record ${runRel.length} Release${runRel.length === 1 ? '' : 's'}`
      }
      busy={busy}
      disabled={disabled}
    >
      {runTarget && (
        <div className="flex flex-col gap-3.5">
          <div className="text-caption text-text-muted bg-blue-soft-bg flex items-start gap-2 rounded-sm px-3 py-2.5">
            <Icon name="info" size={14} className="mt-px flex-none" /> Transfers happen outside
            Medibook. This records the whole run on the shared ledger — one transfer reference per
            statement, visible to each hospital.
          </div>
          <div className="border-border-soft overflow-hidden rounded-md border">
            {runRel.map((r) => {
              const b = bankOf(r.hid);
              return (
                <div
                  key={r.id}
                  className="border-border-soft flex items-center gap-3 border-b px-3.5 py-2.75"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-body text-text-strong font-medium">{hospName(r)}</div>
                    <div className="text-caption text-text-muted tabular-nums">
                      {r.id} · {b ? `${b.bank} ····${String(b.account).slice(-4)}` : '—'} · UTR26-
                      {String(r.id).slice(-4)}R
                    </div>
                  </div>
                  <span className="text-body text-text-strong flex-none font-medium tabular-nums">
                    {money(r.net)}
                  </span>
                </div>
              );
            })}
            <div className="bg-bg-tint text-body text-text-navy flex justify-between px-3.5 py-3 font-medium">
              <span>Total to release</span>
              <span className="tabular-nums">{money(runRel.reduce((a, r) => a + r.net, 0))}</span>
            </div>
          </div>
          {runSkip.length > 0 && (
            <div className="text-caption text-y-700 bg-y-100 flex items-start gap-2 rounded-sm px-3 py-2.5">
              <Icon name="triangle-alert" size={14} className="mt-px flex-none" /> Skipped — no
              payout account on file: {runSkip.map((r) => hospName(r)).join(', ')}. Release them
              individually once the hospital adds bank details.
            </div>
          )}
          <OpsField label="Remark for this run (optional · visible to every hospital in it)">
            {(field) => (
              <textarea
                id={field.id}
                value={remark}
                onChange={(e) => onRemarkChange(e.target.value)}
                placeholder="e.g. Weekly payout run of 20 Jun"
                className="border-border rounded-input text-body-lg text-text-strong h-16 w-full resize-none border p-3"
              ></textarea>
            )}
          </OpsField>
        </div>
      )}
    </FormModal>
  );
}
