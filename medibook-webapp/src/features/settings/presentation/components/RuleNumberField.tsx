import { Icon } from '@/shared/ui/Icon';
import { TextInput } from '@/shared/ui/TextInput';

interface RuleNumberFieldProps {
  id: string;
  value: string;
  /** Shown after the input: "days", "%", "min". */
  unit: string;
  /** Accessible name (the row's label sits outside the input). */
  label: string;
  error?: string;
  placeholder?: string;
  disabled: boolean;
  onChange: (value: string) => void;
}

/** A small numeric input with its unit and inline error, for a `RuleRow`. */
export function RuleNumberField({
  id,
  value,
  unit,
  label,
  error,
  placeholder,
  disabled,
  onChange,
}: RuleNumberFieldProps) {
  return (
    <div className="flex w-44 flex-none flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <div className="w-24">
          <TextInput
            id={id}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            height={40}
            inputMode="decimal"
            aria-label={label}
            invalid={Boolean(error)}
            disabled={disabled}
          />
        </div>
        <span className="text-caption text-text-muted w-12">{unit}</span>
      </div>
      {error && (
        <span className="text-caption text-d-700 flex items-center gap-1 text-right">
          <Icon name="triangle-alert" size={12} /> {error}
        </span>
      )}
    </div>
  );
}
