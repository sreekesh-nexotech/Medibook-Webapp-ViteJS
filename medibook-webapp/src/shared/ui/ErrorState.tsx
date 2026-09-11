import type { ReactNode } from 'react';

import { cn } from '@/shared/lib/cn';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { Icon } from '@/shared/ui/Icon';
import type { IconName } from '@/shared/ui/icon-registry';

/**
 * The canonical error state — audit 3.2/4.3. A failed load must say what
 * happened and offer a way forward, so `onRetry` renders a real Retry button
 * rather than leaving the user on blank space.
 *
 * Two presentations, same copy discipline:
 *   default  a centred card, for a whole screen or route that failed
 *            (`app/layouts/ScreenError` is this, with the crash copy)
 *   inline   no card, no min-height — for one failed section, panel or
 *            drawer body inside an otherwise healthy screen.
 */

const DEFAULT_TITLE = 'Something went wrong';
const DEFAULT_MESSAGE = "That didn't load. Retrying usually fixes it — your data is safe.";

interface ErrorStateProps {
  title?: ReactNode;
  message?: ReactNode;
  /** Glyph in the tinted badge. Default `triangle-alert`. */
  icon?: IconName;
  /** Renders the Retry button when provided. */
  onRetry?: () => void;
  retryLabel?: string;
  /** Extra actions rendered after Retry (e.g. "Back to Dashboard"). */
  children?: ReactNode;
  /** Section variant: no card, no min-height centring. */
  inline?: boolean;
  className?: string;
}

export function ErrorState({
  title = DEFAULT_TITLE,
  message = DEFAULT_MESSAGE,
  icon = 'triangle-alert',
  onRetry,
  retryLabel = 'Retry',
  children,
  inline = false,
  className,
}: ErrorStateProps) {
  const body = (
    <>
      <div
        className={cn(
          'bg-d-100 text-d-500 mx-auto flex items-center justify-center rounded-lg',
          inline ? 'mb-3 size-11' : 'mb-4 size-14',
        )}
      >
        <Icon name={icon} size={inline ? 22 : 26} />
      </div>
      <div className={cn('text-text-strong mb-2', inline ? 'text-h3' : 'text-h2')}>{title}</div>
      <p className={cn('text-body text-text-muted', inline ? 'mb-4' : 'mb-5.5')}>{message}</p>
      <div className="flex flex-wrap justify-center gap-3">
        {onRetry && (
          <Button
            variant="secondary"
            icon="refresh-cw"
            size={inline ? 'sm' : 'md'}
            onClick={onRetry}
          >
            {retryLabel}
          </Button>
        )}
        {children}
      </div>
    </>
  );

  if (inline) return <div className={cn('py-7 text-center', className)}>{body}</div>;

  return (
    <div className={cn('flex min-h-105 items-center justify-center', className)}>
      <Card pad={32} className="max-w-115 text-center">
        {body}
      </Card>
    </div>
  );
}
