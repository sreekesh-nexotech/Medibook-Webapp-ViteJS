import { useCallback, useEffect, useRef, useState } from 'react';

import { IconBtn } from '@/shared/ui/IconBtn';

/**
 * Toolbar refresh button — audit 3.1.1: this control "does nothing on eight
 * screens" and is the single most likely thing a client pokes.
 *
 * `onRefresh` is **required**: a refresh button with nothing behind it is
 * worse than no button, so the type system now refuses to render one. It may
 * return a promise — the icon spins, the button is disabled and `aria-busy`
 * for as long as the work takes, with a floor of `MIN_SPIN_MS` so a refresh
 * that resolves instantly is still visibly acknowledged.
 */

/** Keep the spin on screen long enough to read as feedback. */
const MIN_SPIN_MS = 450;

interface RefreshBtnProps {
  /** Re-fetch / re-derive this screen's data. Sync or async, both supported. */
  onRefresh: () => void | Promise<void>;
  /** Tooltip + accessible name. Default "Refresh". */
  title?: string;
  /** Square box edge in px, to match a neighbouring control. */
  box?: number;
  size?: number;
}

export function RefreshBtn({ onRefresh, title = 'Refresh', box, size }: RefreshBtnProps) {
  const [busy, setBusy] = useState(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const handleClick = useCallback((): void => {
    if (busy) return;
    setBusy(true);
    const floor = new Promise<void>((resolve) => setTimeout(resolve, MIN_SPIN_MS));
    Promise.allSettled([Promise.resolve(onRefresh()), floor]).finally(() => {
      if (mounted.current) setBusy(false);
    });
  }, [busy, onRefresh]);

  return (
    <IconBtn
      name="refresh-cw"
      label={title}
      busy={busy}
      onClick={handleClick}
      box={box}
      size={size}
    />
  );
}
