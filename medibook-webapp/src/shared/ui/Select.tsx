import { cn } from '@/shared/lib/cn';
import { Icon } from '@/shared/ui/Icon';
import { useFieldContext } from '@/shared/ui/field-context';

interface SelectProps {
  value: string;
  options?: readonly string[];
  onChange?: (value: string) => void;
  placeholder?: string;
  /** Control height in px (design default 54; screens pass 40/44/48 — dynamic, hence style). */
  height?: number;

  /* ---- form wiring — all optional, inherited from the enclosing field ---- */

  /** Overrides the id inherited from the enclosing `Field` / `OpsField`. */
  id?: string;
  /** Form control name. */
  name?: string;
  /** Danger border + `aria-invalid`. Inherited from the field when omitted. */
  invalid?: boolean;
  /** Accessible name for a select with no visible label. */
  'aria-label'?: string;
  /** Extra description ids, merged with the field's own message id. */
  'aria-describedby'?: string;
  required?: boolean;
  disabled?: boolean;
  onBlur?: () => void;
  className?: string;
}

export function Select({
  value,
  options = [],
  onChange,
  placeholder,
  height = 54,
  id,
  name,
  invalid,
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedBy,
  required,
  disabled = false,
  onBlur,
  className,
}: SelectProps) {
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
        onBlur={onBlur}
        required={required ?? field?.required}
        disabled={disabled}
        aria-invalid={isInvalid || undefined}
        aria-describedby={describedBy}
        aria-label={ariaLabel}
        className={cn(
          'rounded-input text-body w-full appearance-none border bg-white pr-11 pl-4',
          isInvalid ? 'border-d-500' : 'border-border',
          disabled ? 'text-text-muted bg-grey-200 cursor-not-allowed' : 'cursor-pointer',
          value ? 'text-text-strong' : 'text-text-faint',
          className,
        )}
        style={{ height }}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      <span className="text-text-muted pointer-events-none absolute top-1/2 right-4 -translate-y-1/2">
        <Icon name="chevron-down" size={20} />
      </span>
    </div>
  );
}
