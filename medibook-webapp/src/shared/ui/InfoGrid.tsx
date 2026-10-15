import type { ReactNode } from 'react';

import { cn } from '@/shared/lib/cn';
import { Card } from '@/shared/ui/Card';

export interface InfoGridItem {
  readonly k: string;
  readonly v: ReactNode;
  /** Render the value with tabular figures (the prototype's `num` class). */
  readonly num?: boolean;
}

interface InfoGridProps {
  items: readonly InfoGridItem[];
}

/** Card with a 3-column label/value grid (ops detail screens). */
export function InfoGrid({ items }: InfoGridProps) {
  return (
    <Card>
      <div className="grid grid-cols-3 gap-x-6 gap-y-5">
        {items.map((it) => (
          <div key={it.k} className="flex flex-col gap-1">
            <span className="text-caption text-text-muted">{it.k}</span>
            <span
              className={cn('text-body text-text-strong font-medium', it.num && 'tabular-nums')}
            >
              {it.v}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}
