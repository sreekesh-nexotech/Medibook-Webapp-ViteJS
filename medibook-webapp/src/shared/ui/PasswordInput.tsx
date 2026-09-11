import { useState } from 'react';

import { Icon } from '@/shared/ui/Icon';
import { TextInput } from '@/shared/ui/TextInput';

interface PasswordInputProps {
  value: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  /** Control height in px (design default 54; modals pass 48). */
  height?: number;
  /** Overrides the id inherited from the enclosing `Field`. */
  id?: string;
  /** Form control name — password managers key off this. Default "password". */
  name?: string;
  /**
   * Which password this is, so a manager fills the right thing:
   * `current-password` for sign-in (default), `new-password` for create /
   * reset / change forms.
   */
  autoComplete?: 'current-password' | 'new-password' | 'off';
  invalid?: boolean;
  required?: boolean;
  disabled?: boolean;
  maxLength?: number;
  autoFocus?: boolean;
  onBlur?: () => void;
  'aria-describedby'?: string;
  'aria-label'?: string;
}

/**
 * Password field with a real show/hide control — audit 3.5.5: "No password
 * field has a show or hide control, and no field offers autofill hints, so
 * password managers cannot fill any form in either application."
 *
 * The toggle is a proper button with an `aria-label` that names the action and
 * an `aria-pressed` that reports the current state, so it works from the
 * keyboard and announces correctly.
 */
export function PasswordInput({
  value,
  onChange,
  placeholder,
  height = 54,
  id,
  name = 'password',
  autoComplete = 'current-password',
  invalid,
  required,
  disabled = false,
  maxLength,
  autoFocus,
  onBlur,
  'aria-describedby': ariaDescribedBy,
  'aria-label': ariaLabel,
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  return (
    <TextInput
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      height={height}
      type={visible ? 'text' : 'password'}
      id={id}
      name={name}
      autoComplete={autoComplete}
      invalid={invalid}
      required={required}
      disabled={disabled}
      maxLength={maxLength}
      autoFocus={autoFocus}
      onBlur={onBlur}
      aria-describedby={ariaDescribedBy}
      aria-label={ariaLabel}
      trailing={
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
          disabled={disabled}
          className="text-text-muted hover:text-text-body flex cursor-pointer items-center rounded-sm p-1 transition-colors duration-150"
        >
          <Icon name={visible ? 'eye-off' : 'eye'} size={18} />
        </button>
      }
    />
  );
}
