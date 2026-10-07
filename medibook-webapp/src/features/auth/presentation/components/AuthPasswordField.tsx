import { useState } from 'react';
import type { HTMLInputAutoCompleteAttribute } from 'react';

import { Icon } from '@/shared/ui/Icon';

import { AuthField } from '@/features/auth/presentation/components/AuthField';

interface AuthPasswordFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** `new-password` on set/reset screens, `current-password` on sign-in. Default `new-password`. */
  autoComplete?: HTMLInputAutoCompleteAttribute;
}

/** `AuthField` for a password, with the login screen's show/hide eye. */
export function AuthPasswordField({
  label,
  value,
  onChange,
  placeholder,
  autoComplete = 'new-password',
}: AuthPasswordFieldProps) {
  const [isShown, setIsShown] = useState(false);
  return (
    <AuthField
      label={label}
      type={isShown ? 'text' : 'password'}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      autoComplete={autoComplete}
      trailing={
        <button
          type="button"
          onClick={() => setIsShown((s) => !s)}
          className="flex"
          aria-label={isShown ? 'Hide password' : 'Show password'}
        >
          <Icon name={isShown ? 'eye-off' : 'eye'} size={18} />
        </button>
      }
    />
  );
}
