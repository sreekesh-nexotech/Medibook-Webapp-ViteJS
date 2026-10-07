import type { ReactNode } from 'react';

import { cn } from '@/shared/lib/cn';
import { Icon } from '@/shared/ui/Icon';
import { OPS_TINTS, type OpsTint } from '@/shared/ui/OpsConfirm';
import type { IconName } from '@/shared/ui/icon-registry';

interface OpsEntityProps {
  icon: IconName;
  /** Accent tint of the icon box, keyed into the shared OPS_TINTS map. */
  tint?: OpsTint;
  title: ReactNode;
  sub?: ReactNode;
}

/**
 * Tinted 34px icon box + title/sub column (ops tables' entity cell). Built of
 * spans so it can sit inside a button.
 */
export function OpsEntity({ icon, tint = 'primary', title, sub }: OpsEntityProps) {
  const t = OPS_TINTS[tint];
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <span
        className={cn('flex size-8.5 flex-none items-center justify-center rounded-md', t[0], t[1])}
      >
        <Icon name={icon} size={16} />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="text-body text-text-strong truncate font-medium">{title}</span>
        <span className="text-caption text-text-muted truncate">{sub}</span>
      </span>
    </span>
  );
}
