import { useId, type ReactNode } from 'react';

import { cn } from '@/shared/lib/cn';
import { Icon } from '@/shared/ui/Icon';
import { FieldContext, type FieldContextValue } from '@/shared/ui/field-context';

interface FieldProps {
  label: ReactNode;
  /**
   * The control. Either an element (the usual case) or a render function, if
   * the control needs the generated id/invalid flag directly rather than
   * through `FieldContext`.
   */
  children?: ReactNode | ((field: FieldContextValue) => ReactNode);
  required?: boolean;
  /** Layout passthrough for the design's `style` cases (e.g. `col-span-full` for gridColumn "1 / -1"). */
  className?: string;
  /**
   * Inline validation message shown under the control — audit 3.5.1: "the
   * hospital app cannot tell a user which field is wrong, so every failed save
   * is a toast that disappears in under three seconds". Identical treatment to
   * `OpsField`, so both halves of the product finally agree.
   */
  error?: string | null;
  /** Persistent helper text, shown when there is no error. */
  hint?: ReactNode;
  /** Override the generated input id (rare — only when an id already exists). */
  htmlFor?: string;
}

/** White in-app form field: label + control + inline error / hint. */
export function Field({
  label,
  children,
  required = false,
  className,
  error,
  hint,
  htmlFor,
}: FieldProps) {
  const reactId = useId();
  const id = htmlFor ?? `field-${reactId}`;
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
    <div className={cn('flex flex-col gap-2', className)}>
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
