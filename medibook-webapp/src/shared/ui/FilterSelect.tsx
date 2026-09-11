import { cn } from '@/shared/lib/cn';
import { Icon } from '@/shared/ui/Icon';
import { useFieldContext } from '@/shared/ui/field-context';

interface FilterSelectProps {
  value: string;
  options: readonly string[];
  onChange?: (value: string) => void;

  /* ---- form wiring — all optional, inherited from the enclosing field ---- */

  /** Overrides the id inherited from the enclosing `Field` / `OpsField`. */
  id?: string;
  /** Form control name. */
  name?: string;
  /**
   * Accessible name. A toolbar filter usually has no visible label, so pass
   * one here — "Filter by status", "Filter by department" — otherwise a screen
   * reader announces only the current value (audit 3.3.4).
   */
  'aria-label'?: string;
  'aria-describedby'?: string;
  /** Danger border + `aria-invalid`. Inherited from the field when omitted. */
  invalid?: boolean;
  disabled?: boolean;
  className?: string;
}

/** Small filter dropdown used in toolbars (compact). */
export function FilterSelect({
  value,
  options,
  onChange,
  id,
  name,
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedBy,
  invalid,
  disabled = false,
  className,
}: FilterSelectProps) {
  const field = useFieldContext();
  const selectId = id ?? field?.id;
  const isInvalid = invalid ?? field?.invalid ?? false;
  const describedBy =
    [field?.describedById, ariaDescribedBy].filter(Boolean).join(' ') || undefined;
  return (
    <div className="relative">
      <select
        id={selectId}
        name={name}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        disabled={disabled}
        aria-invalid={isInvalid || undefined}
        aria-describedby={describedBy}
        aria-label={ariaLabel}
        className={cn(
          'rounded-input text-body text-text-body h-11 appearance-none border bg-white pr-10 pl-4',
          isInvalid ? 'border-d-500' : 'border-border',
          disabled ? 'bg-grey-200 cursor-not-allowed' : 'cursor-pointer',
          className,
        )}
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      <span className="text-text-muted pointer-events-none absolute top-1/2 right-3 -translate-y-1/2">
        <Icon name="chevron-down" size={18} />
      </span>
    </div>
  );
}
