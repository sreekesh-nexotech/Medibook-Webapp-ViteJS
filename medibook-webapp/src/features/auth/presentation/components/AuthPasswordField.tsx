import { useState } from 'react';

import { Icon } from '@/shared/ui/Icon';

import { AuthField } from '@/features/auth/presentation/components/AuthField';

interface AuthPasswordFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** `current-password` to sign in, `new-password` to set one. */
  autoComplete: 'current-password' | 'new-password';
}

/** `AuthField` for a password, with a named show/hide toggle (A11Y-04). */
export function AuthPasswordField({
  label,
  value,
  onChange,
  placeholder,
  autoComplete,
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
          className="flex size-9 cursor-pointer items-center justify-center rounded-sm"
          aria-label="Show password"
          aria-pressed={isShown}
        >
          <Icon name={isShown ? 'eye-off' : 'eye'} size={18} />
        </button>
      }
    />
  );
}
