import { cn } from '@/shared/lib/cn';
import { money } from '@/shared/lib/format';
import { Card } from '@/shared/ui/Card';
import { SectionTitle } from '@/shared/ui/SectionTitle';
import { SkeletonTable } from '@/shared/ui/Skeleton';
import { TableShell, tdClass } from '@/shared/ui/TableShell';

import type { RevenueRow } from './dashboard.viewModel';

interface RevenueSplitCardProps {
  /** The period's label, e.g. "Today". */
  period: string;
  loading: boolean;
  byChannel: readonly RevenueRow[];
  byMethod: readonly RevenueRow[];
}

/**
 * Revenue split (appendix 02 R1): what was collected online (by Medibook) and
 * at the desk, and by payment method, from `revenue.by_channel` /
 * `by_method`. Refund and net columns appear once the backend splits refunds
 * the same way (DASH-02); until then only the hospital-wide refund total is
 * known, on the Revenue tile.
 */
export function RevenueSplitCard({ period, loading, byChannel, byMethod }: RevenueSplitCardProps) {
  const hasRefundSplit = byChannel.some((r) => r.refunded !== null);
  const figures = hasRefundSplit ? ['Collected', 'Refunded', 'Net'] : ['Collected'];

  const table = (title: string, first: string, rows: readonly RevenueRow[]) => (
    <div className="min-w-0 flex-1">
      <div className="text-caption text-text-muted mb-2 font-semibold">{title}</div>
      <TableShell columns={[first, ...figures]} rightCols={figures} scrollLabel={title}>
        {rows.map((r) => (
          <tr key={r.key}>
            <td className={cn(tdClass, 'text-text-strong font-medium')}>{r.label}</td>
            <td className={cn(tdClass, 'text-right tabular-nums')}>{money(r.collected)}</td>
            {hasRefundSplit && (
              <>
                <td className={cn(tdClass, 'text-d-500 text-right tabular-nums')}>
                  {r.refunded === null ? '—' : money(r.refunded)}
                </td>
                <td className={cn(tdClass, 'text-right font-semibold tabular-nums')}>
                  {r.net === null ? '—' : money(r.net)}
                </td>
              </>
            )}
          </tr>
        ))}
      </TableShell>
    </div>
  );

  return (
    <Card>
      <SectionTitle size={16} className="mb-4">
        Revenue split — {period}
      </SectionTitle>
      {loading ? (
        <SkeletonTable rows={3} cols={3} card={false} />
      ) : byMethod.length === 0 && byChannel.every((r) => r.collected === 0) ? (
        <div className="text-body text-text-muted">
          No payments were collected {period.toLowerCase()}.
        </div>
      ) : (
        <div className="flex flex-wrap gap-5">
          {table('By channel', 'Channel', byChannel)}
          {table('By payment method', 'Method', byMethod)}
        </div>
      )}
      <div className="text-caption text-text-muted mt-3">
        Payments captured in the period; online bookings are collected by Medibook and settled to
        the hospital later.
        {hasRefundSplit ? ' Refunds are those processed in the period.' : ''}
      </div>
    </Card>
  );
}
