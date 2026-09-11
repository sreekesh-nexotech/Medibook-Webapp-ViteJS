import type { ReactNode } from 'react';

import { useDialog } from '@/shared/hooks/useDialog';
import { Icon } from '@/shared/ui/Icon';

interface SidebarDrawerProps {
  open: boolean;
  onClose: () => void;
  /** Accessible name, e.g. "Hospital navigation". */
  label: string;
  /** The sidebar, rendered in its `full` presentation inside the panel. */
  children?: ReactNode;
}

/**
 * Off-canvas wrapper that carries a shell's sidebar below `lg` — audit 3.4.1.
 * Scrim + slide-in panel, with the same Escape / focus-trap / focus-return /
 * scroll-lock behaviour as `Modal` and `Drawer` (shared `useDialog`), so the
 * mobile navigation is keyboard-usable rather than a trap.
 *
 * It is only ever mounted below `lg`, so the desktop shell is untouched.
 */
export function SidebarDrawer({ open, onClose, label, children }: SidebarDrawerProps) {
  const { panelRef } = useDialog({ open, onClose });
  if (!open) return null;
  return (
    <div
      onClick={onClose}
      className="animate-fade-in bg-text-strong/45 fixed inset-0 z-70 flex justify-start lg:hidden"
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="animate-fade-in shadow-pop relative flex h-full max-w-full"
      >
        {children}
        <button
          type="button"
          aria-label="Close navigation"
          onClick={onClose}
          className="text-text-muted absolute top-4 right-3 flex cursor-pointer"
        >
          <Icon name="x" size={20} />
        </button>
      </div>
    </div>
  );
}
