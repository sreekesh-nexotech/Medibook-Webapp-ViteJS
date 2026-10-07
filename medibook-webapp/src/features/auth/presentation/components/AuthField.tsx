import { useId, type ReactNode } from 'react';

import { cn } from '@/shared/lib/cn';

/**
 * Labelled auth input with an optional trailing adornment (the password
 * show/hide eye), ported 1:1 from the design `Auth.jsx` `AuthField`. The label
 * names the input (A11Y-04), and `autoComplete` lets password managers fill
 * the sign-in form.
 */
interface AuthFieldProps {
  label: string;
  value: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  type?: string;
  /** e.g. `username`, `current-password`, `new-password`. */
  autoComplete?: string;
  /** Trailing adornment rendered inside the field (e.g. the eye toggle). */
  trailing?: ReactNode;
}

export function AuthField({
  label,
  value,
  onChange,
  placeholder,
  type,
  autoComplete,
  trailing,
}: AuthFieldProps) {
  const id = useId();
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-label font-ui text-text-navy">
        {label}
      </label>
      <div className="relative flex items-center">
        <input
          id={id}
          type={type ?? 'text'}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className={cn(
            'text-body border-border-control bg-bg-subtle text-text-navy h-14 w-full rounded-sm border',
            trailing ? 'pr-12 pl-4' : 'px-4',
          )}
        />
        {trailing && <span className="text-text-muted absolute right-2 flex">{trailing}</span>}
      </div>
    </div>
  );
}
