import { useEffect, useRef } from 'react';

/**
 * Escape closes a topbar popover (bell panel, account menu) and returns focus
 * to the button that opened it (01·F19). Clicks outside are handled by the
 * popover's own scrim.
 */
export function usePopoverDismiss(open: boolean, onClose: () => void) {
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return;
      onCloseRef.current();
      triggerRef.current?.focus();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  return triggerRef;
}
