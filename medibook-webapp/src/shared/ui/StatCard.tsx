import type { ReactNode } from 'react';

import { cn } from '@/shared/lib/cn';
import { Card } from '@/shared/ui/Card';
import { Icon } from '@/shared/ui/Icon';
import type { IconName } from '@/shared/ui/icon-registry';

/**
 * KPI tile datum. The prototype's color contract `{ c, bg, sc? }` (CSS color
 * strings) is redesigned to Tailwind class strings:
 *   - `bg` + `c` on the 38px icon box  → `iconClass`  (e.g. 'bg-g-100 text-g-800')
 *   - `c` on the stat number           → `valueClass` (e.g. 'text-g-800')
 *   - `sc` on the caption, falling back to `c` → `subClass`, falling back to
 *     `valueClass` (e.g. 'text-text-muted')
 * e.g. prototype `{ c: 'var(--g-600)', bg: 'var(--g-100)' }` becomes
 * `{ iconClass: 'bg-g-100 text-g-800', valueClass: 'text-g-800' }`.
 */
export interface StatCardData {
  readonly icon: IconName;
  readonly label: string;
  readonly value: ReactNode;
  readonly sub: ReactNode;
  readonly iconClass: string;
  readonly valueClass: string;
  readonly subClass?: string;
}

interface StatCardProps {
  k: StatCardData;
  onClick?: () => void;
}

/** Dashboard KPI tile — icon box + label, stat number, caption sub-line. */
export function StatCard({ k, onClick }: StatCardProps) {
  return (
    <Card className="min-w-0 flex-1 basis-52" pad={18} onClick={onClick} hover={Boolean(onClick)}>
      <div className="flex items-center gap-2.5">
        <div
          className={cn(
            'flex size-9.5 flex-none items-center justify-center rounded-md',
            k.iconClass,
          )}
        >
          <Icon name={k.icon} size={20} />
        </div>
        <span className="text-body text-text-strong font-medium">{k.label}</span>
      </div>
      <div className={cn('text-stat mt-3 mb-1 whitespace-nowrap', k.valueClass)}>{k.value}</div>
      <div className={cn('text-caption', k.subClass ?? k.valueClass)}>{k.sub}</div>
    </Card>
  );
}
