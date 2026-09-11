import { useId, type ReactNode } from 'react';

import { Icon } from '@/shared/ui/Icon';
import { FieldContext, type FieldContextValue } from '@/shared/ui/field-context';

interface OpsFieldProps {
  label: ReactNode;
  /** Inline validation error shown under the control with a warning glyph. */
  error?: string | null;
  /** The control, or a render function that needs the generated id directly. */
  children?: ReactNode | ((field: FieldContextValue) => ReactNode);
  required?: boolean;
  /** Persistent helper text, shown when there is no error. */
  hint?: ReactNode;
  /** Override the generated input id (rare — only when an id already exists). */
  htmlFor?: string;
}

/**
 * Ops form field — label (+ required star) with an inline validation error
 * line. Shares `FieldContext` with `Field`, so the label is genuinely tied to
 * its control here too (audit 3.3.4) without any call-site change.
 */
export function OpsField({
  label,
  error,
  children,
  required = false,
  hint,
  htmlFor,
}: OpsFieldProps) {
  const reactId = useId();
  const id = htmlFor ?? `ops-field-${reactId}`;
  const messageId = `${id}-message`;
  const invalid = Boolean(error);
  const hasMessage = invalid || Boolean(hint);
  const field: FieldContextValue = {
    id,
    describedById: hasMessage ? messageId : undefined,
    invalid,
    required,
  };
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="font-ui text-label text-text-strong">
        {label}
        {required && <span className="text-d-500"> *</span>}
      </label>
      <FieldContext.Provider value={field}>
        {typeof children === 'function' ? children(field) : children}
      </FieldContext.Provider>
      {invalid ? (
        <span id={messageId} className="text-caption text-d-700 flex items-center gap-1.5">
          <Icon name="triangle-alert" size={13} /> {error}
        </span>
      ) : (
        hint && (
          <span id={messageId} className="text-caption text-text-muted">
            {hint}
          </span>
        )
      )}
    </div>
  );
}
