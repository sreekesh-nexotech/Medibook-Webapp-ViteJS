import { cn } from '@/shared/lib/cn';
import { Badge } from '@/shared/ui/Badge';

import type { ReportCell } from '@/features/reports/application/store/reports.types';

interface ReportCellViewProps {
  cell: ReportCell;
}

/**
 * Draws one already-rendered report cell. The reports layer decides what a
 * cell *says* (`reports.logic.ts`); this decides only what it *looks like*, so
 * one table component can serve all fourteen reports.
 */
export function ReportCellView({ cell }: ReportCellViewProps) {
  if (cell.kind === 'badge') return <Badge status={cell.status}>{cell.label}</Badge>;

  const isNum = cell.kind === 'num';
  return (
    <div className={cn('flex flex-col', isNum && 'items-end')}>
      <span
        className={cn(
          isNum && 'tabular-nums',
          cell.kind === 'text' && cell.strong === true
            ? 'text-text-strong font-medium'
            : 'text-text-body',
        )}
      >
        {cell.text}
      </span>
      {cell.sub !== undefined && cell.sub !== '' && (
        <span className={cn('text-caption text-text-muted', isNum && 'tabular-nums')}>
          {cell.sub}
        </span>
      )}
    </div>
  );
}
