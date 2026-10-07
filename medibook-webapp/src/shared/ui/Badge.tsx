import type { CSSProperties, ReactNode } from 'react';

import { cn } from '@/shared/lib/cn';
import { STATUS } from '@/shared/ui/status-map';

interface BadgeProps {
  status?: string;
  /** Overrides the displayed label (prototype: `children || status`). */
  children?: ReactNode;
  className?: string;
  /** Runtime data-driven overrides only — static styling goes in className. */
  style?: CSSProperties;
}

/** Widened view for safe lookup of statuses outside the known map. */
const STATUS_LOOKUP: Record<string, { bg: string; fg: string } | undefined> = STATUS;

/**
 * Neutral pill for a status the palette does not know — a new backend enum
 * value must read as itself, never borrow "Scheduled" blue and pass for a
 * booking state (UAT-76, 01·F37). Same pair as the palette's neutral pills.
 */
const UNKNOWN_STATUS = { bg: 'bg-grey-300', fg: 'text-grey-900' } as const;

/** Status pill; an unknown status shows its own text on a neutral pill. */
export function Badge({ status, children, className, style }: BadgeProps) {
  const label = children || status;
  const s = STATUS_LOOKUP[status ?? ''] ?? UNKNOWN_STATUS;
  return (
    <span
      className={cn(
        'text-badge inline-flex items-center rounded-full px-3.5 py-1 font-semibold whitespace-nowrap',
        s.bg,
        s.fg,
        className,
      )}
      style={style}
    >
      {label}
    </span>
  );
}
