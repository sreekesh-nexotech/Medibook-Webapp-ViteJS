import type { ReactNode } from 'react';

import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { SkeletonBlock } from '@/shared/ui/Skeleton';
import type { IconName } from '@/shared/ui/icon-registry';

/**
 * Loading / empty / error **inside** a table body — audit 3.2.4, where two
 * console tables "show a heading over blank space with nothing at all".
 *
 * One `<tr>` (or a few, while loading) spanning the full width, so the header
 * row stays put and the table never collapses. Vertical padding comes from the
 * global 22px "Comfy" `td`/`th` rule in `src/index.css` — no per-cell `py-*`.
 *
 * Either drop it into a `<tbody>` yourself:
 *
 * ```tsx
 * <TableShell columns={COLS}>
 *   {rows.length === 0 ? (
 *     <TableState colSpan={COLS.length} kind="empty" title="No results match your filters."
 *                 actionLabel="Clear filters" onAction={clearAll} />
 *   ) : rows.map(…)}
 * </TableShell>
 * ```
 *
 * …or let `TableShell` do the `colSpan` bookkeeping via its `state` prop.
 */

export type TableStateKind = 'loading' | 'empty' | 'error';

/** Everything `TableState` needs except the column count. */
export interface TableStateSpec {
  kind: TableStateKind;
  /** `loading`: how many shimmer rows to draw. Default 5. */
  rows?: number;
  /** `empty` / `error` headline. Sensible defaults per kind. */
  title?: ReactNode;
  /** One sentence of context. */
  message?: ReactNode;
  /** `empty`: glyph in the round badge. Default `search`. */
  icon?: IconName;
  /** `empty`: the way out — e.g. "Clear filters". */
  actionLabel?: string;
  onAction?: () => void;
  /** `error`: renders the Retry button. */
  onRetry?: () => void;
}

export interface TableStateProps extends TableStateSpec {
  /** Must equal the table's column count, or the row will not span it. */
  colSpan: number;
}

const DEFAULT_EMPTY_TITLE = 'No results match your filters.';
const DEFAULT_ERROR_TITLE = "This table didn't load";
const DEFAULT_LOADING_ROWS = 5;

export function TableState({
  colSpan,
  kind,
  rows = DEFAULT_LOADING_ROWS,
  title,
  message,
  icon,
  actionLabel,
  onAction,
  onRetry,
}: TableStateProps) {
  if (kind === 'loading') {
    return (
      <>
        {Array.from({ length: rows }, (_, i) => (
          <tr key={i}>
            <td colSpan={colSpan} className="border-border-soft border-b px-3.5">
              {i === 0 && (
                <span role="status" className="sr-only">
                  Loading…
                </span>
              )}
              <SkeletonBlock w="100%" h={14} />
            </td>
          </tr>
        ))}
      </>
    );
  }

  return (
    <tr>
      <td colSpan={colSpan} className="px-3.5">
        {kind === 'error' ? (
          <ErrorState
            inline
            title={title ?? DEFAULT_ERROR_TITLE}
            message={message}
            onRetry={onRetry}
          />
        ) : (
          <EmptyState
            compact
            icon={icon}
            title={title ?? DEFAULT_EMPTY_TITLE}
            message={message}
            actionLabel={actionLabel}
            onAction={onAction}
          />
        )}
      </td>
    </tr>
  );
}
