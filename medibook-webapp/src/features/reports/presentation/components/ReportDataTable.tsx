import { useMemo } from 'react';

import type { SortState } from '@/shared/hooks/useSort';
import { Pager } from '@/shared/ui/Pager';
import { TableShell, tdClass } from '@/shared/ui/TableShell';
import type { TableStateSpec } from '@/shared/ui/TableState';

import type {
  ReportTable,
  ReportTableRow,
} from '@/features/reports/application/store/reports.types';

import { REPORT_PAGE_SIZE } from '../reports.data';

import { ReportCellView } from './ReportCellView';

interface ReportDataTableProps {
  table: ReportTable;
  /** Rows already sorted by the screen's `useSort`. */
  rows: readonly ReportTableRow[];
  sort: SortState;
  onSort: (key: string) => void;
  page: number;
  onPage: (page: number) => void;
  state?: TableStateSpec;
  /** Accessible name of the horizontal scroll region. */
  scrollLabel: string;
}

/**
 * The report data table — audit HA-13: "each shows four fixed tiles with no
 * data table". Column labels, alignment, sort keys and cells all come from the
 * `ReportTable` the reports layer built out of the filtered rows, so every one
 * of the fourteen reports gets a real, sortable, paged table from one
 * component.
 */
export function ReportDataTable({
  table,
  rows,
  sort,
  onSort,
  page,
  onPage,
  state,
  scrollLabel,
}: ReportDataTableProps) {
  const pageRows = useMemo(
    () => rows.slice(page * REPORT_PAGE_SIZE, (page + 1) * REPORT_PAGE_SIZE),
    [rows, page],
  );

  return (
    <>
      <TableShell
        columns={table.columns}
        rightCols={table.rightCols}
        sortKeys={table.sortKeys}
        sort={sort}
        onSort={onSort}
        state={state}
        scrollLabel={scrollLabel}
      >
        {pageRows.map((row) => (
          <tr key={row.id}>
            {row.cells.map((cell, i) => (
              <td key={table.columns[i] ?? String(i)} className={tdClass}>
                <ReportCellView cell={cell} />
              </td>
            ))}
          </tr>
        ))}
      </TableShell>

      <Pager
        total={rows.length}
        page={page}
        pageSize={REPORT_PAGE_SIZE}
        onPage={onPage}
        noun={table.noun}
      />
    </>
  );
}
