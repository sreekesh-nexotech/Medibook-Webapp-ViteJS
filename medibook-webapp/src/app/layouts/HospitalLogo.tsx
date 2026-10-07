import { useState } from 'react';

/** The Medibook mark, shown until (or unless) the hospital's own logo loads. */
const MEDIBOOK_MARK = '/brand/medibook-mark.svg';

/**
 * The hospital's uploaded logo in the shell (PRD-02), falling back to the
 * Medibook mark when there is none or its link fails to load (expired, or
 * unreachable storage).
 */
export function HospitalLogo({ src, className }: { src: string | null; className: string }) {
  const [failed, setFailed] = useState<string | null>(null);
  const shown = src && src !== failed ? src : MEDIBOOK_MARK;
  return (
    <img
      src={shown}
      alt=""
      className={className}
      onError={() => {
        if (shown !== MEDIBOOK_MARK) setFailed(shown);
      }}
    />
  );
}
