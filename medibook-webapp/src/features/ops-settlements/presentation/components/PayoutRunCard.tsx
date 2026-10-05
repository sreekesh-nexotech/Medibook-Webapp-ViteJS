import { cn } from '@/shared/lib/cn';
import { fmtDate, money, moneyShort } from '@/shared/lib/format';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { Icon } from '@/shared/ui/Icon';
import { SectionTitle } from '@/shared/ui/SectionTitle';
import { TableShell } from '@/shared/ui/TableShell';

import {
  RUN_STATUS_LABEL,
  runnablePeriods,
  type LedgerRow,
  type RunGroup,
} from '@/features/ops-settlements/presentation/components/opsSettlements.viewModel';
import { SettlementQueueRow } from '@/features/ops-settlements/presentation/components/SettlementQueueRow';

interface PayoutRunCardProps {
  group: RunGroup;
  /** ISO today, for the "due" highlight. */
  today: string;
  /** True while this card's approve request is in flight. */
  approving: boolean;
  onApprove: (runId: string) => void;
  onReleaseRun: (group: RunGroup) => void;
  onCreateRun: () => void;
  onOpenHosp: (hospitalId: string) => void;
  onRelease: (row: LedgerRow) => void;
}

/**
 * One payout-run card. A real run shows its number, status and scheduled
 * date, with Approve (draft) or Release Run (approved); the unassigned group
 * collects closed periods no run has picked up yet, with Create Payout Run.
 */
export function PayoutRunCard({
  group,
  today,
  approving,
  onApprove,
  onReleaseRun,
  onCreateRun,
  onOpenHosp,
  onRelease,
}: PayoutRunCardProps) {
  const { run, rows } = group;
  const relRows = rows.filter((r) => r.releasable && r.payout?.hasBankAccount);
  const skipRows = rows.filter((r) => r.releasable && !r.payout?.hasBankAccount);
  const total = rows.reduce((a, r) => a + r.netRupees, 0);
  const relTotal = relRows.reduce((a, r) => a + r.netRupees, 0);
  const runnable = run === null ? runnablePeriods(rows) : [];
  const due = run?.scheduledFor != null && run.scheduledFor <= today && relRows.length > 0;
  return (
    <Card>
      <div className="mb-3.5 flex flex-wrap items-center gap-3">
        <div
          className={cn(
            'flex size-9.5 flex-none items-center justify-center rounded-md',
            due ? 'bg-y-100 text-y-600' : 'bg-blue-soft-bg text-text-navy',
          )}
        >
          <Icon name="calendar-days" size={18} />
        </div>
        <div className="min-w-0">
          <SectionTitle size={16}>
            {run
              ? `Payout run ${run.runNo} · ${run.scheduledFor ? fmtDate(run.scheduledFor) : 'Unscheduled'}${due ? ' — due' : ''}`
              : 'Not in a payout run'}
          </SectionTitle>
          <div className="text-caption text-text-muted">
            {run ? `${RUN_STATUS_LABEL[run.status]} · ` : ''}
            {rows.length} statement{rows.length === 1 ? '' : 's'} · net {money(total)}
            {skipRows.length > 0 ? ` · ${skipRows.length} not releasable (no payout account)` : ''}
          </div>
        </div>
        <div className="flex-1"></div>
        {run === null && runnable.length > 0 && (
          <Button size="sm" icon="plus" onClick={onCreateRun}>
            Create Payout Run ({runnable.length})
          </Button>
        )}
        {run?.status === 'draft' && (
          <Button size="sm" icon="check" busy={approving} onClick={() => onApprove(run.id)}>
            Approve Run
          </Button>
        )}
        {run && relRows.length > 0 && (
          <Button size="sm" icon="landmark" onClick={() => onReleaseRun(group)}>
            Release Run ({relRows.length} · {moneyShort(relTotal)})
          </Button>
        )}
      </div>
      <TableShell
        columns={['Statement', 'Gross', 'Commission', 'Net Payable', 'Status', 'Action']}
        scrollLabel="Statements in this payout run"
        rightCols={['Gross', 'Commission', 'Net Payable']}
      >
        {rows.map((s) => (
          <SettlementQueueRow
            key={s.id}
            s={s}
            showDate={false}
            onOpenHosp={onOpenHosp}
            onRelease={onRelease}
          />
        ))}
      </TableShell>
    </Card>
  );
}
