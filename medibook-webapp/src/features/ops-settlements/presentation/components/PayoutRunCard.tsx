import { DEMO_TODAY_ISO } from '@/core/config/demo';
import { bankOf } from '@/features/ops-hospitals/application/store/hospitals.store';
import { cn } from '@/shared/lib/cn';
import { fmtDate, money, moneyShort } from '@/shared/lib/format';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { Icon } from '@/shared/ui/Icon';
import { SectionTitle } from '@/shared/ui/SectionTitle';
import { TableShell } from '@/shared/ui/TableShell';

import { releasable, type PayoutRun, type SettlementRow } from './settlement-model';
import { SettlementQueueRow } from './SettlementQueueRow';

interface PayoutRunCardProps {
  run: PayoutRun;
  /** The commission column label (carries the live commission %). */
  commCol: string;
  onOpenRun: (date: string) => void;
  onOpenHosp: (hid: number) => void;
  onRelease: (row: SettlementRow) => void;
  onRetry: (row: SettlementRow) => void;
}

/** One payout-run card — due highlight, skipped caption, bulk Release Run. */
export function PayoutRunCard({
  run,
  commCol,
  onOpenRun,
  onOpenHosp,
  onRelease,
  onRetry,
}: PayoutRunCardProps) {
  const relRows = run.rows.filter((r) => releasable(r) && bankOf(r.hid));
  const skipRows = run.rows.filter((r) => releasable(r) && !bankOf(r.hid));
  const total = run.rows.reduce((a, r) => a + r.net, 0);
  const relTotal = relRows.reduce((a, r) => a + r.net, 0);
  const due = run.date !== 'unscheduled' && run.date <= DEMO_TODAY_ISO;
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
            Payout run · {run.date === 'unscheduled' ? 'Unscheduled' : fmtDate(run.date)}
            {due && relRows.length > 0 ? ' — due' : ''}
          </SectionTitle>
          <div className="text-caption text-text-muted">
            {run.rows.length} statement{run.rows.length === 1 ? '' : 's'} · net {money(total)}
            {skipRows.length > 0 ? ` · ${skipRows.length} not releasable (no payout account)` : ''}
          </div>
        </div>
        <div className="flex-1"></div>
        {relRows.length > 0 && (
          <Button size="sm" icon="landmark" onClick={() => onOpenRun(run.date)}>
            Release Run ({relRows.length} · {moneyShort(relTotal)})
          </Button>
        )}
      </div>
      <TableShell
        columns={['Statement', 'Gross', commCol, 'Net Payable', 'Status', 'Action']}
        scrollLabel="Statements in this payout run"
        rightCols={['Gross', commCol, 'Net Payable']}
      >
        {run.rows.map((s) => (
          <SettlementQueueRow
            key={s.id}
            s={s}
            showDate={false}
            onOpenHosp={onOpenHosp}
            onRelease={onRelease}
            onRetry={onRetry}
          />
        ))}
      </TableShell>
    </Card>
  );
}
