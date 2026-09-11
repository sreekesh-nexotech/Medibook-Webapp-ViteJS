import type { CSSProperties, ReactNode } from 'react';

import { cn } from '@/shared/lib/cn';

interface SectionTitleProps {
  children?: ReactNode;
  /** DOM id, so a dialog can point `aria-labelledby` at its own title. */
  id?: string;
  /** Prototype size hint: >= 24 renders the h1 token, >= 20 h2, else h3. */
  size?: number;
  /** Runtime data-driven overrides only — static styling goes in className. */
  style?: CSSProperties;
  className?: string;
}

export function SectionTitle({ children, id, size = 16, style, className }: SectionTitleProps) {
  return (
    <h3
      id={id}
      className={cn(
        'text-text-strong m-0',
        size >= 24 ? 'text-h1' : size >= 20 ? 'text-h2' : 'text-h3',
        className,
      )}
      style={style}
    >
      {children}
    </h3>
  );
}
