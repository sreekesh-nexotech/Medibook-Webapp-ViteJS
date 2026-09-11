import { cn } from '@/shared/lib/cn';

interface SpinnerProps {
  /** Square edge + ring diameter in px (data-driven, hence style). */
  size?: number;
  /** Ring thickness in px. */
  thickness?: number;
  /**
   * Text a screen reader announces. Keep it specific ("Loading appointments")
   * where the context is not obvious from the surrounding copy.
   */
  label?: string;
  /**
   * Suppress the `role="status"` announcement — for a spinner that is purely
   * decorative because its container already announces the busy state (e.g.
   * inside a `Button busy`, which sets `aria-busy` itself).
   */
  decorative?: boolean;
  className?: string;
}

/**
 * The one loading spinner. Draws its ring from `currentColor`, so it inherits
 * whatever text colour it sits in — white on a primary button, muted in a
 * card — and never needs a colour prop.
 *
 * Use it for an action in flight (a button, a row, a small inline region).
 * Use `Skeleton` instead for a screen or block that is loading its first
 * paint; use `TableState kind="loading"` inside a table body.
 */
export function Spinner({
  size = 18,
  thickness = 2,
  label = 'Loading',
  decorative = false,
  className,
}: SpinnerProps) {
  return (
    <span
      role={decorative ? undefined : 'status'}
      aria-hidden={decorative ? true : undefined}
      className={cn('inline-flex flex-none items-center justify-center', className)}
      style={{ width: size, height: size }}
    >
      <span
        className="animate-spin rounded-full border-current border-t-transparent"
        style={{ width: size, height: size, borderWidth: thickness }}
      />
      {!decorative && <span className="sr-only">{label}</span>}
    </span>
  );
}
