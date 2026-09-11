/**
 * Real "Save as PDF" — audit 3.1.5. `src/index.css` already ships a
 * `@media print` block that hides `body *` and shows `.print-area` full page,
 * so handing one element that class and calling `window.print()` produces a
 * genuine, dependency-free PDF through the browser's own print dialog.
 *
 * A control wired to this opens the print dialog, so it must be labelled
 * "Save as PDF" / "Print" — never "Download PDF", which promises a file the
 * browser may not write.
 */

/** Class the global `@media print` rule isolates. */
const PRINT_AREA_CLASS = 'print-area';

/**
 * Safety net: some browsers never fire `afterprint` (or fire it before the
 * dialog closes). Strip the class on a timer too so the element can never be
 * left in its print-isolated state.
 */
const CLEANUP_FALLBACK_MS = 1500;

/**
 * Print just `el`: temporarily marks it as the print area, opens the print
 * dialog, and removes the mark again on `afterprint` (or on a fallback timer).
 * A null `el` is a no-op — callers can pass a ref's `.current` straight in.
 */
export function printElement(el: HTMLElement | null): void {
  if (!el) return;

  // Never strip a class the element already carried (e.g. a receipt body that
  // is permanently a print area).
  const wasAlreadyPrintArea = el.classList.contains(PRINT_AREA_CLASS);
  let cleaned = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const cleanup = (): void => {
    if (cleaned) return;
    cleaned = true;
    if (timer !== undefined) clearTimeout(timer);
    window.removeEventListener('afterprint', cleanup);
    if (!wasAlreadyPrintArea) el.classList.remove(PRINT_AREA_CLASS);
  };

  el.classList.add(PRINT_AREA_CLASS);
  window.addEventListener('afterprint', cleanup);
  timer = setTimeout(cleanup, CLEANUP_FALLBACK_MS);

  try {
    window.print();
  } catch {
    // A blocked or unavailable print dialog must not leave the page isolated.
    cleanup();
  }
}
