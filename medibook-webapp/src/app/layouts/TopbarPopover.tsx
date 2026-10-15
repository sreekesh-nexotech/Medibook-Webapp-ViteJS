import type { ReactNode } from 'react';

import { useDialog } from '@/shared/hooks/useDialog';
import { cn } from '@/shared/lib/cn';

interface TopbarPopoverProps {
  open: boolean;
  onClose: () => void;
  /** What a screen reader announces for the panel, e.g. "Notifications". */
  label: string;
  /** Width and horizontal position. */
  className: string;
  children: ReactNode;
}

/**
 * A top-bar panel (notifications, the account menu) that works from the
 * keyboard (A11Y-01): focus moves into it when it opens, Escape closes it and
 * returns focus to the button that opened it, and tabbing out closes it.
 * A click anywhere else closes it too.
 */
export function TopbarPopover({ open, onClose, label, className, children }: TopbarPopoverProps) {
  const { panelRef } = useDialog({ open, onClose, trapFocus: false, lockScroll: false });
  if (!open) return null;
  return (
    <>
      <div onClick={onClose} aria-hidden="true" className="fixed inset-0 z-30" />
      <div
        ref={panelRef}
        role="dialog"
        aria-label={label}
        tabIndex={-1}
        onBlur={(e) => {
          if (e.relatedTarget instanceof Node && !e.currentTarget.contains(e.relatedTarget)) {
            onClose();
          }
        }}
        className={cn(
          'border-border shadow-pop absolute top-18 right-2 z-40 max-w-full overflow-hidden rounded-lg border bg-white',
          className,
        )}
      >
        {children}
      </div>
    </>
  );
}

/** One row of the account menu: a real button, so Enter and Space work. */
export function TopbarMenuItem({
  icon,
  danger = false,
  onClick,
  children,
}: {
  icon: ReactNode;
  danger?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'hover:bg-grey-200 flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2.25 text-left transition-colors duration-150',
        danger ? 'text-d-600' : 'text-text-body',
      )}
    >
      {icon} <span className="text-body font-medium">{children}</span>
    </button>
  );
}
