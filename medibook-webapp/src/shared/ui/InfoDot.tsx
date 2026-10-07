import { useId, useState } from 'react';

import { cn } from '@/shared/lib/cn';

interface InfoDotProps {
  text: string;
  /** Size driver in px: dot box = size + 5, glyph = size − 4 (dynamic, hence style). */
  size?: number;
}

/**
 * Small 'i' info dot with a tooltip — explains why a field/data matters
 * (e.g. mobile-app impact). The dot is a button, so the tip opens on keyboard
 * focus as well as on hover, stays while the pointer moves onto it, and
 * Escape closes it; screen readers read the text as the dot's description
 * (A11Y-01).
 */
export function InfoDot({ text, size = 15 }: InfoDotProps) {
  const [open, setOpen] = useState(false);
  const tipId = useId();
  return (
    <span
      className="relative inline-flex align-middle"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-label="More information"
        aria-describedby={tipId}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setOpen(false);
        }}
        className="border-text-muted text-text-muted inline-flex flex-none cursor-help items-center justify-center rounded-full border-[1.5px] leading-normal font-semibold"
        style={{ width: size + 5, height: size + 5, fontSize: size - 4 }}
      >
        i
      </button>
      <span
        id={tipId}
        role="tooltip"
        className={cn(
          open
            ? 'bg-text-strong text-caption shadow-pop absolute bottom-full left-1/2 z-80 mb-2 w-57.5 -translate-x-1/2 rounded-md px-3 py-2.25 text-left font-normal text-white'
            : 'sr-only',
        )}
      >
        {text}
        {open && (
          <span className="border-t-text-strong absolute top-full left-1/2 -translate-x-1/2 border-x-6 border-t-6 border-x-transparent"></span>
        )}
      </span>
    </span>
  );
}
