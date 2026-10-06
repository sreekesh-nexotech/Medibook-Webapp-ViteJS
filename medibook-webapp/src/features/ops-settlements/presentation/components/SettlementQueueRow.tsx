import { cn } from '@/shared/lib/cn';
import { fmtDate, money } from '@/shared/lib/format';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { CanOps } from '@/shared/ui/CanOps';
import { Icon } from '@/shared/ui/Icon';
import { OpsEntity } from '@/shared/ui/OpsEntity';
import { tdClass } from '@/shared/ui/TableShell';

import {
  datePart,
  opsTintOf,
  type LedgerRow,
} from '@/features/ops-settlements/presentation/components/opsSettlements.viewModel';

interface SettlementQueueRowProps {
  s: LedgerRow;
  /** Flat list shows an Expected column; payout-run cards do not. */
  showDate: boolean;
  onOpenHosp: (hospitalId: string) => void;
  /** Release / Retry — parent guards the missing-bank case. */
  onRelease: (row: LedgerRow) => void;
}

/** What a row that cannot be released right now is waiting on. */
function waitingOn(s: LedgerRow): string {
  if (s.run?.status === 'draft') return 'Approve the run first';
  if (s.run === null && s.netRupees <= 0) return 'Nothing to pay — net ≤ 0';
  if (s.run === null) return 'Not in a payout run yet';
  return 'Not releasable';
}

/** One statement (settlement period) row of the settlement queue (design `settleRow`). */
export function SettlementQueueRow({
  s,
  showDate,
  onOpenHosp,
  onRelease,
}: SettlementQueueRowProps) {
  const note = s.payout?.failureReason ?? s.payout?.notes ?? null;
  return (
    <tr>
      <td
        onClick={() => onOpenHosp(s.hospitalId)}
        title="Open hospital profile"
        className={cn(tdClass, 'cursor-pointer')}
      >
        <OpsEntity
          icon="landmark"
          tint={opsTintOf(Math.round(s.grossRupees) % 5)}
          title={s.hospitalName}
          sub={s.periodLabel}
        />
        {note && <div className="text-caption text-blue mt-1 ml-11">“{note}”</div>}
      </td>
      <td className={cn(tdClass, 'text-right tabular-nums')}>{money(s.grossRupees)}</td>
      <td className={cn(tdClass, 'text-right tabular-nums')}>{money(s.commissionRupees)}</td>
      <td className={cn(tdClass, 'text-text-strong text-right font-medium tabular-nums')}>
        {money(s.netRupees)}
      </td>
      {showDate && <td className={tdClass}>{fmtDate(s.expected)}</td>}
      <td className={tdClass}>
        <Badge status={s.status} />
        {s.payout?.utrRef && (
          <div className="text-caption text-text-muted mt-1 tabular-nums">{s.payout.utrRef}</div>
        )}
      </td>
      <td className={tdClass}>
        {s.releasable ? (
          // SEC-05: releasing money needs settlements.edit.
          <CanOps perm="settlements.edit">
            {s.status === 'Payout failed' ? (
              <Button size="sm" variant="secondary" icon="refresh-cw" onClick={() => onRelease(s)}>
                Retry
              </Button>
            ) : (
              <Button size="sm" onClick={() => onRelease(s)}>
                Release
              </Button>
            )}
          </CanOps>
        ) : s.status === 'Released' ? (
          <span className="text-caption text-g-600 inline-flex items-center gap-1.25">
            <Icon name="check" size={15} /> {fmtDate(datePart(s.payout?.releasedAt ?? null))}
          </span>
        ) : (
          <span className="text-caption text-text-muted">{waitingOn(s)}</span>
        )}
      </td>
    </tr>
  );
}
