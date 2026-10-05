import type { SortState } from '@/shared/hooks/useSort';
import { Pager } from '@/shared/ui/Pager';
import { TableShell, tdClass } from '@/shared/ui/TableShell';
import type { TableStateSpec } from '@/shared/ui/TableState';

import type {
  ReportColumnDef,
  ReportRow,
} from '@/features/reports/domain/entities/reports.entities';

import { REPORT_PAGE_SIZE } from '../reports.data';

import { ReportCellView } from './ReportCellView';
import { cellFor, isNumericKind } from './reportsFormat';

interface ReportDataTableProps {
  columns: readonly ReportColumnDef[];
  /** The current page's rows, already sorted and paged by the server. */
  rows: readonly ReportRow[];
  /** Filtered rows across all pages. */
  total: number;
  sort: SortState;
  onSort: (key: string) => void;
  /** Zero-based page index. */
  page: number;
  onPage: (page: number) => void;
  noun: string;
  state?: TableStateSpec;
  /** Accessible name of the horizontal scroll region. */
  scrollLabel: string;
}

/**
 * The report data table — audit HA-13: "each shows four fixed tiles with no
 * data table". Columns, alignment and sort keys come from the server's report
 * definition, so every report gets a real, sortable, paged table from one
 * component. Sorting and paging happen on the server.
 */
export function ReportDataTable({
  columns,
  rows,
  total,
  sort,
  onSort,
  page,
  onPage,
  noun,
  state,
  scrollLabel,
}: ReportDataTableProps) {
  const labels = columns.map((c) => c.label);
  const rightCols = columns.filter((c) => isNumericKind(c.kind)).map((c) => c.label);
  const sortKeys = Object.fromEntries(columns.map((c) => [c.label, c.key]));

  return (
    <>
      <TableShell
        columns={labels}
        rightCols={rightCols}
        sortKeys={sortKeys}
        sort={sort}
        onSort={onSort}
        state={state}
        scrollLabel={scrollLabel}
      >
        {rows.map((row, i) => (
          // Report rows carry no id; position within this page is their identity.
          <tr key={`${page}-${i}`}>
            {columns.map((column, c) => (
              <td key={column.key} className={tdClass}>
                <ReportCellView cell={cellFor(column, row[column.key] ?? null, c === 0)} />
              </td>
            ))}
          </tr>
        ))}
      </TableShell>

      <Pager total={total} page={page} pageSize={REPORT_PAGE_SIZE} onPage={onPage} noun={noun} />
    </>
  );
}
