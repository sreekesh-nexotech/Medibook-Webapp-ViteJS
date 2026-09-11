import { useCallback, useEffect, useId, useRef, type RefObject } from 'react';

/**
 * The accessibility behaviour every overlay owes a keyboard user — audit 3.3.3
 * ("No dialog can be closed with Escape, and none traps focus"). One
 * implementation, shared by `Modal` and `Drawer` so the two can never drift:
 *
 *  - Escape closes.
 *  - Focus moves into the panel on open (first focusable element, else the
 *    panel itself).
 *  - Tab / Shift+Tab cycle inside the panel and never reach the page behind.
 *  - Focus returns to whatever was focused before the dialog opened.
 *  - Body scroll is locked while open and restored afterwards.
 *
 * It renders nothing and adds no styling, so a dialog's visuals are untouched.
 */

/** Everything natively focusable, minus anything explicitly removed from the order. */
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'summary',
  'iframe',
  'object',
  'embed',
  '[contenteditable]:not([contenteditable="false"])',
  '[tabindex]',
].join(',');

export interface UseDialogOptions {
  /** Whether the dialog is mounted/visible. */
  open: boolean;
  /** Called by Escape (and by the caller's own scrim/close button). */
  onClose: () => void;
  /** Close on Escape. Default `true`. */
  closeOnEscape?: boolean;
  /** Keep Tab focus inside the panel. Default `true`. */
  trapFocus?: boolean;
  /** Lock `document.body` scroll while open. Default `true`. */
  lockScroll?: boolean;
}

export interface UseDialogResult {
  /** Put this on the dialog panel (the element that holds the content). */
  panelRef: RefObject<HTMLDivElement | null>;
  /** Put this on the title element and pass it as the panel's `aria-labelledby`. */
  titleId: string;
  /** Put this on the description element when the dialog has one. */
  descriptionId: string;
}

/** Visible, focusable descendants of `panel`, in tab order. */
function focusableWithin(panel: HTMLElement): HTMLElement[] {
  const nodes = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
  return nodes.filter((el) => {
    if (el.getAttribute('aria-hidden') === 'true') return false;
    if (el.tabIndex < 0) return false;
    // offsetParent is null for display:none subtrees; fixed elements report
    // null too, hence the rect fallback.
    return el.offsetParent !== null || el.getBoundingClientRect().width > 0;
  });
}

export function useDialog({
  open,
  onClose,
  closeOnEscape = true,
  trapFocus = true,
  lockScroll = true,
}: UseDialogOptions): UseDialogResult {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const reactId = useId();
  const titleId = `dialog-title-${reactId}`;
  const descriptionId = `dialog-desc-${reactId}`;

  // Keep the latest onClose without re-running the focus/scroll effect on
  // every render — synced in its own effect so nothing writes a ref in render.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const focusFirst = useCallback((): void => {
    const panel = panelRef.current;
    if (!panel) return;
    const targets = focusableWithin(panel);
    if (targets.length > 0) targets[0].focus();
    else panel.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    focusFirst();

    const onKeyDown = (e: KeyboardEvent): void => {
      if (closeOnEscape && e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (!trapFocus || e.key !== 'Tab' || !panel) return;
      const targets = focusableWithin(panel);
      if (targets.length === 0) {
        e.preventDefault();
        panel.focus();
        return;
      }
      const first = targets[0];
      const last = targets[targets.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === panel || !panel.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !panel.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);

    const body = document.body;
    const previousOverflow = body.style.overflow;
    if (lockScroll) body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      if (lockScroll) body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, [open, closeOnEscape, trapFocus, lockScroll, focusFirst]);

  return { panelRef, titleId, descriptionId };
}
