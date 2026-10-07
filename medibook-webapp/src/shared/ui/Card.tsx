import type { CSSProperties, KeyboardEvent, MouseEventHandler, ReactNode } from 'react';

import { cn } from '@/shared/lib/cn';

interface CardProps {
  children?: ReactNode;
  /** Runtime data-driven overrides only — static styling goes in className. */
  style?: CSSProperties;
  /** Padding in px — screens pass varying values (0, 14, 24…), hence style. */
  pad?: number;
  onClick?: MouseEventHandler<HTMLDivElement>;
  /** Elevate to shadow-pop on hover (prototype's JS boxShadow swap). */
  hover?: boolean;
  className?: string;
  /** Accessible name of a clickable card (e.g. "Open pending approvals"). */
  ariaLabel?: string;
}

/** Enter and Space activate a clickable card like a button (UAT-76, 01·F31). */
function activateOnKey(event: KeyboardEvent<HTMLDivElement>): void {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  event.preventDefault();
  event.currentTarget.click();
}

export function Card({
  children,
  style,
  pad = 20,
  onClick,
  hover,
  className,
  ariaLabel,
}: CardProps) {
  const isClickable = onClick !== undefined;
  return (
    <div
      onClick={onClick}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      aria-label={isClickable ? ariaLabel : undefined}
      onKeyDown={isClickable ? activateOnKey : undefined}
      className={cn(
        'border-border shadow-card rounded-xl border bg-white transition-shadow duration-150',
        hover && 'hover:shadow-pop',
        onClick ? 'cursor-pointer' : 'cursor-default',
        className,
      )}
      style={{ padding: pad, ...style }}
    >
      {children}
    </div>
  );
}
