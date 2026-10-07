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
}

/** Enter or Space on a clickable card clicks it, like a button (A11Y-01). */
function clickOnKey(e: KeyboardEvent<HTMLDivElement>): void {
  if (e.target !== e.currentTarget || (e.key !== 'Enter' && e.key !== ' ')) return;
  e.preventDefault();
  e.currentTarget.click();
}

export function Card({ children, style, pad = 20, onClick, hover, className }: CardProps) {
  return (
    <div
      onClick={onClick}
      {...(onClick ? { role: 'button', tabIndex: 0, onKeyDown: clickOnKey } : {})}
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
