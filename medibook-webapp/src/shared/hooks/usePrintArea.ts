import { useCallback, useRef, type RefObject } from 'react';

import { printElement } from '@/shared/lib/print';

/**
 * Turns one element into a real "Save as PDF" target — audit 3.1.5. Put `ref`
 * on the block that should appear on the page and wire `print` to a button:
 *
 * ```tsx
 * const { ref, print } = usePrintArea<HTMLDivElement>();
 * <div ref={ref}>…receipt…</div>
 * <Button icon="printer" onClick={print}>Save as PDF</Button>
 * ```
 *
 * Label the control "Save as PDF" or "Print" — it opens the browser's print
 * dialog, which is a genuine PDF path, but it is not a file download.
 */
export interface UsePrintAreaResult<T extends HTMLElement> {
  ref: RefObject<T | null>;
  print: () => void;
}

export function usePrintArea<T extends HTMLElement = HTMLDivElement>(): UsePrintAreaResult<T> {
  const ref = useRef<T | null>(null);
  const print = useCallback(() => printElement(ref.current), []);
  return { ref, print };
}
