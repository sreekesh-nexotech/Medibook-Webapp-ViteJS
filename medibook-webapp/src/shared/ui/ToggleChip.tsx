import { cn } from '@/shared/lib/cn';

interface ToggleChipProps {
  /** Whether the chip is on (selected). */
  pressed: boolean;
  onChange: (pressed: boolean) => void;
  children: string;
  disabled?: boolean;
}

/**
 * One option of a multi-select filter, as a pressable chip (`aria-pressed`),
 * e.g. the principals of the compliance log. Several sit side by side; each
 * toggles on its own.
 */
export function ToggleChip({ pressed, onChange, children, disabled = false }: ToggleChipProps) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      disabled={disabled}
      onClick={() => onChange(!pressed)}
      className={cn(
        'text-body rounded-md border px-3 py-2 transition-colors duration-150',
        pressed
          ? 'border-blue bg-blue-soft-bg text-blue'
          : 'border-border text-text-muted bg-white',
        disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
      )}
    >
      {children}
    </button>
  );
}
