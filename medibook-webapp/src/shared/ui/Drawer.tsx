import type { ReactNode } from 'react';

import { useDialog } from '@/shared/hooks/useDialog';
import { Icon } from '@/shared/ui/Icon';
import { SectionTitle } from '@/shared/ui/SectionTitle';

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  subtitle?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  /** Panel width in px — varies per call site, hence style. */
  width?: number;
  /** Accessible name when the drawer has no visible `title`. */
  ariaLabel?: string;
}

/**
 * Right-side slide-over drawer. The prototype positioned this absolutely
 * inside its windowed stage — ported as a fixed full-viewport overlay (same
 * visual at 100% zoom).
 *
 * Accessibility comes from `useDialog` (audit 3.3.3) — Escape, focus entry,
 * focus trap, focus return and scroll lock — sharing one implementation with
 * `Modal`. The markup and classes are unchanged, so the drawer is
 * pixel-identical to before.
 */
export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  width = 460,
  ariaLabel,
}: DrawerProps) {
  const { panelRef, titleId } = useDialog({ open, onClose });
  if (!open) return null;
  return (
    <div
      onClick={onClose}
      className="animate-fade-in bg-text-strong/45 fixed inset-0 z-60 flex justify-end"
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-label={title ? undefined : ariaLabel}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="animate-slide-in bg-bg-app shadow-pop flex h-full max-w-full flex-col"
        style={{ width }}
      >
        <div className="border-border flex items-start justify-between border-b bg-white px-6 py-5">
          <div>
            <SectionTitle id={titleId} size={18}>
              {title}
            </SectionTitle>
            {subtitle && <div className="text-caption text-text-muted mt-0.75">{subtitle}</div>}
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="text-text-muted flex cursor-pointer"
          >
            <Icon name="x" size={22} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
        {footer && (
          <div className="border-border flex flex-wrap gap-3 border-t bg-white px-6 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
