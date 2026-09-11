import type { KeyboardEventHandler, ReactNode } from 'react';

import { cn } from '@/shared/lib/cn';
import { Icon } from '@/shared/ui/Icon';
import { useFieldContext } from '@/shared/ui/field-context';
import type { IconName } from '@/shared/ui/icon-registry';

interface TextInputProps {
  value: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  /** Control height in px (design default 54; modals pass 48 — dynamic, hence style). */
  height?: number;
  type?: string;
  /** Optional leading glyph (e.g. "search"). */
  icon?: IconName;
  /** Element pinned to the right inside the control (e.g. a show/hide toggle). */
  trailing?: ReactNode;

  /* ---- form wiring (audit 3.3.4 / 3.5.5) ---------------------------------
   * Every one of these is optional and defaults to today's behaviour. Inside
   * a `Field` / `OpsField` the id, `aria-describedby`, `aria-invalid` and
   * `required` are taken from `FieldContext` automatically — pass them
   * explicitly only for a control that lives outside a field. */

  /** Overrides the id inherited from the enclosing field. */
  id?: string;
  /** Form control name — required for password managers and autofill. */
  name?: string;
  /** Autofill hint, e.g. "email", "tel", "name", "current-password". */
  autoComplete?: string;
  /** On-screen keyboard hint on mobile, e.g. "numeric", "tel", "email". */
  inputMode?: 'text' | 'numeric' | 'tel' | 'email' | 'decimal' | 'search' | 'url' | 'none';
  /** Danger border + `aria-invalid`. Inherited from the field when omitted. */
  invalid?: boolean;
  /** Extra description ids, merged with the field's own message id. */
  'aria-describedby'?: string;
  /** Accessible name for a control with no visible label. */
  'aria-label'?: string;
  required?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  maxLength?: number;
  /**
   * Native `min`/`max` bounds. Mainly for `type="date"`, where the browser's
   * own picker greys out anything outside the range — so an out-of-range date
   * cannot be chosen in the first place, rather than being rejected after.
   */
  min?: string | number;
  max?: string | number;
  autoFocus?: boolean;
  onKeyDown?: KeyboardEventHandler<HTMLInputElement>;
  onBlur?: () => void;
  className?: string;
}

export function TextInput({
  value,
  onChange,
  placeholder,
  height = 54,
  type,
  icon,
  trailing,
  id,
  name,
  autoComplete,
  inputMode,
  invalid,
  'aria-describedby': ariaDescribedBy,
  'aria-label': ariaLabel,
  required,
  disabled = false,
  readOnly = false,
  maxLength,
  min,
  max,
  autoFocus,
  onKeyDown,
  onBlur,
  className,
}: TextInputProps) {
  const field = useFieldContext();
  const inputId = id ?? field?.id;
  const isInvalid = invalid ?? field?.invalid ?? false;
  const describedBy =
    [field?.describedById, ariaDescribedBy].filter(Boolean).join(' ') || undefined;
  return (
    <div className="relative flex items-center">
      {icon && (
        <span className="text-text-muted absolute left-4 flex">
          <Icon name={icon} size={18} />
        </span>
      )}
      <input
        id={inputId}
        name={name}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={onBlur}
        placeholder={placeholder}
        type={type ?? 'text'}
        autoComplete={autoComplete}
        inputMode={inputMode}
        required={required ?? field?.required}
        disabled={disabled}
        readOnly={readOnly}
        maxLength={maxLength}
        min={min}
        max={max}
        autoFocus={autoFocus}
        aria-invalid={isInvalid || undefined}
        aria-describedby={describedBy}
        aria-label={ariaLabel}
        className={cn(
          'rounded-input text-body text-text-strong w-full border bg-white',
          isInvalid ? 'border-d-500' : 'border-border',
          disabled && 'text-text-muted bg-grey-200 cursor-not-allowed',
          icon ? 'pl-11' : 'pl-4',
          trailing ? 'pr-11' : 'pr-4',
          className,
        )}
        style={{ height }}
      />
      {trailing && <span className="absolute right-3 flex items-center">{trailing}</span>}
    </div>
  );
}
