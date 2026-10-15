import { cn } from '@/shared/lib/cn';
import { useFieldContext } from '@/shared/ui/field-context';

interface TextAreaProps {
  value: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  /** Visible lines before it scrolls. */
  rows?: number;
  maxLength?: number;
  disabled?: boolean;
  readOnly?: boolean;
  /** Overrides the enclosing field's invalid state. */
  invalid?: boolean;
  'aria-label'?: string;
  onBlur?: () => void;
  /** Monospace text, e.g. Markdown source or a message template with placeholders. */
  mono?: boolean;
  name?: string;
}

/** Default visible lines. */
const DEFAULT_ROWS = 4;

/**
 * Multi-line text input with the same look and field wiring as `TextInput`:
 * inside an `OpsField` / `Field` it takes the label's id, `aria-describedby`,
 * `aria-invalid` and `required` from the field context.
 */
export function TextArea({
  value,
  onChange,
  placeholder,
  rows = DEFAULT_ROWS,
  maxLength,
  disabled = false,
  readOnly = false,
  invalid,
  'aria-label': ariaLabel,
  onBlur,
  mono = false,
  name,
}: TextAreaProps) {
  const field = useFieldContext();
  const isInvalid = invalid ?? field?.invalid ?? false;
  return (
    <textarea
      id={field?.id}
      name={name}
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      onBlur={onBlur}
      placeholder={placeholder}
      rows={rows}
      maxLength={maxLength}
      disabled={disabled}
      readOnly={readOnly}
      required={field?.required}
      aria-invalid={isInvalid || undefined}
      aria-describedby={field?.describedById}
      aria-label={ariaLabel}
      className={cn(
        'rounded-input text-body text-text-strong w-full resize-y border bg-white p-3',
        isInvalid ? 'border-d-500' : 'border-border',
        disabled && 'text-text-muted bg-grey-200 cursor-not-allowed',
        mono && 'font-mono',
      )}
    />
  );
}
