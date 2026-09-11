import type { ReactNode } from 'react';

import { cn } from '@/shared/lib/cn';
import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';
import type { IconName } from '@/shared/ui/icon-registry';

/**
 * The canonical empty state — audit 3.2/4.3: "the hospital app shows one line
 * of faint grey text with no way out"; "in the patient app neither offers an
 * action". The ops hospitals screen already does this properly (tinted round
 * glyph, a sentence in readable text, and a ghost "Clear filters" button);
 * this is that treatment, once, for both shells.
 *
 * An empty state must always answer two questions: *why is this empty* and
 * *what do I do now*. `title` answers the first; `actionLabel` + `onAction`
 * answer the second — pass them whenever there is anything the user can do
 * (clear a filter, create the first record, change a date range). Copy that
 * reads "No results match your filters." with no action is the bug the audit
 * found, so `onAction` is strongly encouraged even though it is optional (a
 * genuinely actionless empty list — "no audit entries yet" — is the only case
 * that should omit it).
 */

interface EmptyStateProps {
  /** Glyph in the tinted round badge. Default `search`. */
  icon?: IconName;
  /** The one-line headline, e.g. "No results match your filters." */
  title: ReactNode;
  /** One sentence of context under the headline. */
  message?: ReactNode;
  /** Action label, e.g. "Clear filters" / "Book an appointment". */
  actionLabel?: string;
  onAction?: () => void;
  /** Glyph on the action button (only for `variant="button"`). */
  actionIcon?: IconName;
  /**
   * `ghost` (default) matches the ops console's "Clear filters" affordance;
   * `button` renders a primary button for a create-first-record action.
   */
  actionVariant?: 'ghost' | 'button';
  /** Extra actions rendered after the primary one. */
  children?: ReactNode;
  /** Tighter vertical rhythm for an empty state inside a small card or drawer. */
  compact?: boolean;
  className?: string;
}

export function EmptyState({
  icon = 'search',
  title,
  message,
  actionLabel,
  onAction,
  actionIcon,
  actionVariant = 'ghost',
  children,
  compact = false,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-2.5 text-center',
        compact ? 'py-6' : 'py-11',
        className,
      )}
    >
      <div className="bg-grey-300 text-text-muted flex size-12 items-center justify-center rounded-full">
        <Icon name={icon} size={22} />
      </div>
      <span className="text-body text-text-strong font-medium">{title}</span>
      {message && <p className="text-body text-text-muted m-0 max-w-105">{message}</p>}
      {(actionLabel ?? children) && (
        <div className="mt-0.5 flex flex-wrap items-center justify-center gap-3">
          {actionLabel && onAction && (
            <Button
              variant={actionVariant === 'ghost' ? 'ghost' : 'primary'}
              size="sm"
              icon={actionIcon}
              onClick={onAction}
            >
              {actionLabel}
            </Button>
          )}
          {children}
        </div>
      )}
    </div>
  );
}
