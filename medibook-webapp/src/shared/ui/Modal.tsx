import { useState, type ReactNode } from 'react';

import { useDialog } from '@/shared/hooks/useDialog';
import { Button } from '@/shared/ui/Button';
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
  /**
   * `false` for a question that must be answered with one of the footer
   * buttons: no close button, and Escape and the scrim do nothing. Default `true`.
   */
  dismissible?: boolean;
  /**
   * The form inside has unsaved changes: the scrim, Escape and the close
   * button ask before discarding them (A11Y-07). The footer's own Cancel
   * still closes at once.
   */
  dirty?: boolean;
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
 * pixel-identical to before. A modal opened from another (a drawer, this
 * discard question) takes Escape first, so Escape closes one layer at a time.
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  width = 560,
  footer,
  ariaLabel,
  dismissible = true,
  dirty = false,
}: ModalProps) {
  const [asking, setAsking] = useState(false);
  const requestClose = (): void => {
    if (dirty) setAsking(true);
    else onClose();
  };
  const { panelRef, titleId } = useDialog({
    open,
    onClose: requestClose,
    closeOnEscape: dismissible,
  });
  if (!open) return null;
  return (
    <div
      onClick={dismissible ? requestClose : undefined}
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
          {dismissible && (
            <button
              type="button"
              aria-label="Close"
              onClick={requestClose}
              className="text-text-muted flex cursor-pointer"
            >
              <Icon name="x" size={22} />
            </button>
          )}
        </div>
        <div className="p-6">{children}</div>
        {footer && <div className="flex justify-end gap-3 px-6 pb-6">{footer}</div>}
      </div>
      <Modal
        open={asking}
        onClose={() => setAsking(false)}
        title="Discard your changes?"
        width={420}
        footer={
          <>
            <Button variant="secondary" onClick={() => setAsking(false)}>
              Keep editing
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setAsking(false);
                onClose();
              }}
            >
              Discard
            </Button>
          </>
        }
      >
        <p className="text-body text-text-body m-0">What you entered here has not been saved.</p>
      </Modal>
    </div>
  );
}
