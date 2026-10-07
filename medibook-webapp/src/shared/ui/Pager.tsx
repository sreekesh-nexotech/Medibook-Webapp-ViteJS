import type { ReactNode } from 'react';

import { cn } from '@/shared/lib/cn';
import { Icon } from '@/shared/ui/Icon';

interface PagerProps {
  total: number;
  /** Zero-based page index. */
  page: number;
  pageSize?: number;
  onPage: (page: number) => void;
  /** Record noun in the "Showing m–n of T {noun}" line. */
  noun?: string;
  /** Extra content rendered to the left of the prev/next controls. */
  right?: ReactNode;
}

/** Shared table pagination footer — "Showing m–n of T" + prev/next squares. */
export function Pager({ total, page, pageSize = 8, onPage, noun = 'records', right }: PagerProps) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const pg = Math.min(page, pages - 1);
  const from = total === 0 ? 0 : pg * pageSize + 1;
  const to = Math.min((pg + 1) * pageSize, total);
  const prevDisabled = pg === 0;
  const nextDisabled = pg >= pages - 1;
  const arrowClass = (isDisabled: boolean) =>
    cn(
      'border-border text-text-body inline-flex size-9 items-center justify-center rounded-md border',
      isDisabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer',
    );
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
      <span className="text-body text-text-muted">
        Showing {from}–{to} of {total} {noun}
      </span>
      <div className="flex items-center gap-3.5">
        {right}
        {pages > 1 && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Previous page"
              disabled={prevDisabled}
              onClick={() => onPage(Math.max(0, pg - 1))}
              className={arrowClass(prevDisabled)}
            >
              <Icon name="chevron-left" size={16} />
            </button>
            <button
              type="button"
              aria-label="Next page"
              disabled={nextDisabled}
              onClick={() => onPage(Math.min(pages - 1, pg + 1))}
              className={arrowClass(nextDisabled)}
            >
              <Icon name="chevron-right" size={16} />
            </button>
            <span className="text-body text-text-muted self-center" aria-live="polite">
              Page {pg + 1} of {pages}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
