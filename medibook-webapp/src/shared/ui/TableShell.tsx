import type { ReactNode } from 'react';

import type { SortState } from '@/shared/hooks/useSort';
import { cn } from '@/shared/lib/cn';
import { SortTh } from '@/shared/ui/SortTh';
import { TableState, type TableStateSpec } from '@/shared/ui/TableState';

/**
 * Shared table cell classes — the prototype's `thBase` / `tdBase` translated
 * to tokens. Vertical padding comes from the global 22px "Comfy" density rule
 * on all `td`/`th` (`src/index.css`) — never add per-cell `py-*`.
 */
export const thClass =
  'bg-bg-tint text-text-navy text-body font-semibold px-3.5 text-left border-b border-border-soft whitespace-nowrap';
export const tdClass = 'px-3.5 border-b border-border-soft text-body text-text-body align-middle';

/**
 * From this many columns up, the table gets a min-width below `lg` so it
 * scrolls sideways instead of crushing (audit 3.4.1: "no table can scroll
 * sideways — below desktop width the tables crush and clip"). Four columns or
 * fewer still fit a tablet, and several of those live inside narrow cards, so
 * they are left alone.
 */
const MIN_WIDTH_COLUMN_THRESHOLD = 5;

interface TableShellProps {
  columns: readonly string[];
  /** Columns to right-align (label + sort chevron flipped). */
  rightCols?: readonly string[];
  /** Column label → sort key, wiring headers to `useSort`. */
  sortKeys?: Readonly<Record<string, string | undefined>>;
  sort?: SortState;
  onSort?: (key: string) => void;
  children?: ReactNode;
  /**
   * Render a loading / empty / error row instead of `children`, with the
   * `colSpan` filled in from `columns`. Audit 3.2.4 — a table must never be a
   * heading over blank space.
   */
  state?: TableStateSpec;
  /**
   * Accessible name for the horizontal scroll region, so a keyboard user who
   * tabs into it is told what they are scrolling. Default "Table".
   */
  scrollLabel?: string;
}

/**
 * Bordered, rounded table wrapper with a SortTh header row per column.
 *
 * The table sits in its own `overflow-x-auto` scroller, which is focusable and
 * exposed as a labelled `region` so it can be scrolled from the keyboard. At
 * `lg` and above nothing is constrained, so desktop rendering is unchanged.
 */
export function TableShell({
  columns,
  children,
  rightCols = [],
  sortKeys,
  sort,
  onSort,
  state,
  scrollLabel = 'Table',
}: TableShellProps) {
  const needsMinWidth = columns.length >= MIN_WIDTH_COLUMN_THRESHOLD;
  return (
    <div className="border-border-soft overflow-hidden rounded-md border">
      <div
        role="region"
        aria-label={scrollLabel}
        tabIndex={0}
        className="w-full overflow-x-auto overscroll-x-contain"
      >
        <table className={cn('w-full border-collapse', needsMinWidth && 'max-lg:min-w-table-min')}>
          <thead>
            <tr>
              {columns.map((c) => (
                <SortTh
                  key={c}
                  label={c}
                  baseClassName={thClass}
                  right={rightCols.includes(c)}
                  sortKeys={sortKeys}
                  sort={sort}
                  onSort={onSort}
                />
              ))}
            </tr>
          </thead>
          <tbody>{state ? <TableState colSpan={columns.length} {...state} /> : children}</tbody>
        </table>
      </div>
    </div>
  );
}
