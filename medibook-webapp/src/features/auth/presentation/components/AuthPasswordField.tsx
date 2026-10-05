import { useState } from 'react';

import { Icon } from '@/shared/ui/Icon';

import { AuthField } from '@/features/auth/presentation/components/AuthField';

interface AuthPasswordFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

/** `AuthField` for a password, with the login screen's show/hide eye. */
export function AuthPasswordField({ label, value, onChange, placeholder }: AuthPasswordFieldProps) {
  const [isShown, setIsShown] = useState(false);
  return (
    <AuthField
      label={label}
      type={isShown ? 'text' : 'password'}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
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
