import { cn } from '@/shared/lib/cn';

interface ComplianceDateInputProps {
  value: string;
  onChange: (value: string) => void;
  /** Tooltip **and** accessible name — these filters have no visible label. */
  title: string;
  /** Set when the control lives inside an `OpsField` that generated an id. */
  id?: string;
  'aria-describedby'?: string;
  invalid?: boolean;
  /** Full width inside a form field, compact in a filter toolbar. */
  block?: boolean;
}

/**
 * Native date input in the ops filter-toolbar style, matching
 * `OpsLogsScreen`'s date range so the two log screens read as one product.
 *
 * The value stays the input's own `yyyy-mm-dd` string and is compared as a
 * string against equally ISO record dates — never `new Date(value)` +
 * `toISOString()`, which shifts a local midnight back a day.
 */
export function ComplianceDateInput({
  value,
  onChange,
  title,
  id,
  'aria-describedby': ariaDescribedBy,
  invalid = false,
  block = false,
}: ComplianceDateInputProps) {
  return (
    <input
      type="date"
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      title={title}
      aria-label={title}
      aria-invalid={invalid || undefined}
      aria-describedby={ariaDescribedBy}
      className={cn(
        'rounded-input text-body text-text-body border bg-white px-3',
        invalid ? 'border-d-500' : 'border-border',
        block ? 'h-12 w-full' : 'h-11',
      )}
    />
  );
}
