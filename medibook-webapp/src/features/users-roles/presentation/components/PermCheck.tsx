import { cn } from '@/shared/lib/cn';
import { Icon } from '@/shared/ui/Icon';

interface PermCheckProps {
  on: boolean;
  /**
   * Accessible name for this one cell, e.g. "Edit on Payments" — a grid of 40
   * unnamed tick boxes is unusable from the keyboard (audit 3.3.2/3.3.4).
   */
  label: string;
  disabled?: boolean;
  onClick?: () => void;
}

/**
 * Permission-grid checkbox cell (design `Rbac.jsx` `Check`): a filled blue box
 * with a tick when on, a hollow bordered box when off, dimmed when locked.
 *
 * A real `<button role="checkbox">` rather than the prototype's clickable
 * `<span>`, so the grid can be operated — and its state read — from the
 * keyboard. Visuals are unchanged.
 */
export function PermCheck({ on, label, disabled = false, onClick }: PermCheckProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={on}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={disabled ? undefined : onClick}
      className={cn(
        'inline-flex size-5.5 items-center justify-center rounded-[6px] p-0 text-white',
        on ? 'bg-blue' : 'border-border border-[1.5px] bg-white',
        disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
      )}
    >
      {on && <Icon name="check" size={14} />}
    </button>
  );
}
