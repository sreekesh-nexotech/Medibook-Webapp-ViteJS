import type { MouseEventHandler } from 'react';

import { cn } from '@/shared/lib/cn';
import { Icon } from '@/shared/ui/Icon';
import type { IconName } from '@/shared/ui/icon-registry';

interface IconBtnProps {
  name: IconName;
  /**
   * The accessible name — **required**. Audit 3.3.2: "thirty-one icon-only
   * buttons rely on a hover tooltip, which a touch or keyboard user never
   * sees, and four have no name at all, including red delete buttons."
   *
   * Write the action, not the glyph: "Edit appointment", "Delete department",
   * "View invoice" — not "pencil". `title` falls back to this, so one prop
   * gives you both the screen-reader name and the desktop tooltip.
   */
  label: string;
  /** Per-item glyph color from data (e.g. danger red on destructive rows). */
  color?: string;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  /** Hover tooltip. Defaults to `label`; pass it only to say something longer. */
  title?: string;
  size?: number;
  /** Square box edge in px — data-driven, hence style. */
  box?: number;
  /** Unavailable action: dimmed, `cursor-not-allowed`, no `onClick`. */
  disabled?: boolean;
  /** Action in flight: spins the glyph, sets `aria-busy`, blocks `onClick`. */
  busy?: boolean;
  className?: string;
}

/** Square icon-only button (table actions, toolbars). */
export function IconBtn({
  name,
  label,
  color,
  onClick,
  title,
  size = 18,
  box = 44,
  disabled = false,
  busy = false,
  className,
}: IconBtnProps) {
  // `label` is typed as required so every call site is forced to name its
  // button, but the runtime stays tolerant: if one ever slips through
  // untyped, the old `title` still becomes the accessible name.
  const accessibleName = label ?? title;
  const isBlocked = disabled || busy;
  return (
    <button
      type="button"
      aria-label={accessibleName}
      aria-busy={busy || undefined}
      title={title ?? accessibleName}
      disabled={isBlocked}
      onClick={isBlocked ? undefined : onClick}
      className={cn(
        'border-border text-text-muted inline-flex flex-none items-center justify-center rounded-md border bg-white transition-colors duration-150',
        isBlocked ? 'cursor-not-allowed opacity-50' : 'hover:bg-grey-200 cursor-pointer',
        className,
      )}
      style={{ width: box, height: box, color }}
    >
      <Icon name={name} size={size} className={cn(busy && 'animate-spin')} />
    </button>
  );
}
