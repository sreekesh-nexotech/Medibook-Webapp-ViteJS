/**
 * Real "Save as PDF" / "Print" — audit 3.1.5, reworked for paper (PRN-01).
 *
 * The document is copied into a `.print-root` at the end of `<body>`, outside
 * the app and its scrolling modals, and the global `@media print` rules in
 * `src/index.css` show only that copy, in normal flow. A long invoice runs onto
 * as many pages as it needs at the paper's own width (A4, A5), and a token slip
 * prints at the 72 mm an 80 mm thermal roll allows.
 *
 * The copy is removed when the browser says printing finished (`afterprint`).
 * Tablets return from `window.print()` before the preview is drawn, so there is
 * no short timer that could blank the page there; a long one only tidies up a
 * browser that never says.
 *
 * A control wired to this opens the print dialog, so it must be labelled
 * "Save as PDF" / "Print" — never "Download PDF", which promises a file the
 * browser may not write.
 */

/** Class the global `@media print` rules show on paper. */
const PRINT_ROOT_CLASS = 'print-root';
/** Added for a token slip: 72 mm wide, small page margins. */
const PRINT_SLIP_CLASS = 'print-slip';

/** Tidy-up for a browser that never fires `afterprint`. */
const CLEANUP_FALLBACK_MS = 5 * 60_000;

/** `page`: A4/A5 documents (receipts, invoices). `slip`: an 80 mm thermal token slip. */
export type PrintLayout = 'page' | 'slip';

/**
 * Print a copy of `el` and nothing else. A null `el` is a no-op — callers can
 * pass a ref's `.current` straight in.
 */
export function printElement(el: HTMLElement | null, layout: PrintLayout = 'page'): void {
  if (!el) return;

  for (const stale of document.querySelectorAll(`.${PRINT_ROOT_CLASS}`)) stale.remove();
  const root = document.createElement('div');
  root.className = layout === 'slip' ? `${PRINT_ROOT_CLASS} ${PRINT_SLIP_CLASS}` : PRINT_ROOT_CLASS;
  root.appendChild(el.cloneNode(true));
  document.body.appendChild(root);

  let timer: ReturnType<typeof setTimeout> | undefined;
  const cleanup = (): void => {
    window.removeEventListener('afterprint', cleanup);
    if (timer !== undefined) clearTimeout(timer);
    root.remove();
  };
  window.addEventListener('afterprint', cleanup);
  timer = setTimeout(cleanup, CLEANUP_FALLBACK_MS);

  try {
    window.print();
  } catch {
    // A blocked or unavailable print dialog must not leave the copy behind.
    cleanup();
  }
}
