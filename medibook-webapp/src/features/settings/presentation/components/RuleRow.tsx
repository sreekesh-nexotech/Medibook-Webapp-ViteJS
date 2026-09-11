import type { ReactNode } from 'react';

import { cn } from '@/shared/lib/cn';

interface RuleRowProps {
  label: ReactNode;
  children?: ReactNode;
  /**
   * What this rule actually does, derived from the current value — audit
   * 2.6.4: a rule nobody can see the consequence of cannot be validated. e.g.
   * "≈ 32 slots per doctor per day".
   */
  hint?: ReactNode;
  /** Drop the bottom divider on the last row of a card. */
  last?: boolean;
}

/** A single label ↔ control row inside a `RuleCard` (design `RuleRow`). */
export function RuleRow({ label, children, hint, last }: RuleRowProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 py-3.5',
        !last && 'border-border-soft border-b',
      )}
    >
      <span className="flex min-w-0 flex-col">
        <span className="text-body text-text-body">{label}</span>
        {hint && <span className="text-caption text-text-muted mt-0.5">{hint}</span>}
      </span>
      {children}
    </div>
  );
}
