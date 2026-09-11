import type { ReactNode } from 'react';

import { useDialog } from '@/shared/hooks/useDialog';
import { Icon } from '@/shared/ui/Icon';
import { SectionTitle } from '@/shared/ui/SectionTitle';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children?: ReactNode;
  /** Panel width in px — varies per call site (440/560/720…), hence style. */
  width?: number;
  footer?: ReactNode;
  /** Accessible name when the modal has no visible `title`. */
  ariaLabel?: string;
}

/**
 * Centered modal with scrim. The prototype positioned this absolutely inside
 * its windowed stage — ported as a fixed full-viewport overlay (same visual
 * at 100% zoom).
 *
 * Accessibility comes from `useDialog` (audit 3.3.3): `role="dialog"` +
 * `aria-modal`, Escape closes, focus moves into the panel on open, Tab is
 * trapped inside it, focus returns to the trigger on close, and body scroll is
 * locked while open. The markup and classes are unchanged, so the modal is
 * pixel-identical to before.
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  width = 560,
  footer,
  ariaLabel,
}: ModalProps) {
  const { panelRef, titleId } = useDialog({ open, onClose });
  if (!open) return null;
  return (
    <div
      onClick={onClose}
      className="animate-fade-in bg-text-strong/45 fixed inset-0 z-50 flex items-center justify-center p-6"
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-label={title ? undefined : ariaLabel}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="animate-pop-in shadow-pop max-h-full max-w-full overflow-y-auto rounded-xl bg-white"
        style={{ width }}
      >
        <div className="border-border-soft flex items-center justify-between border-b px-6 py-5">
          <SectionTitle id={titleId}>{title}</SectionTitle>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="text-text-muted flex cursor-pointer"
          >
            <Icon name="x" size={22} />
          </button>
        </div>
        <div className="p-6">{children}</div>
        {footer && <div className="flex justify-end gap-3 px-6 pb-6">{footer}</div>}
      </div>
    </div>
  );
}
