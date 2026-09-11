import { cn } from '@/shared/lib/cn';

interface ToggleProps {
  value: boolean;
  onChange: (value: boolean) => void;
  /**
   * Accessible name. A toggle with no adjacent `<label htmlFor>` is announced
   * only as "switch" without this (audit 3.3.2/3.3.4) — pass what it controls,
   * e.g. "Require two-factor authentication".
   */
  label?: string;
  /** Points at the text that names this toggle, when that text is on screen. */
  'aria-labelledby'?: string;
  disabled?: boolean;
}

/**
 * 44x24 switch pill with an 18px knob (left 23px on / 3px off).
 *
 * Exposed as `role="switch"` with `aria-checked`, so assistive technology
 * reports its state instead of announcing an unnamed button.
 */
export function Toggle({
  value,
  onChange,
  label,
  'aria-labelledby': ariaLabelledBy,
  disabled = false,
}: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      aria-label={label}
      aria-labelledby={ariaLabelledBy}
      disabled={disabled}
      onClick={disabled ? undefined : () => onChange(!value)}
      className={cn(
        'relative h-6 w-11 flex-none rounded-full border-none p-0 transition-colors duration-150',
        value ? 'bg-blue' : 'bg-grey-500',
        disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
      )}
    >
      <span
        className={cn(
          'absolute top-0.75 size-4.5 rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.25)] transition-[left] duration-150',
          value ? 'left-5.75' : 'left-0.75',
        )}
      />
    </button>
  );
}
