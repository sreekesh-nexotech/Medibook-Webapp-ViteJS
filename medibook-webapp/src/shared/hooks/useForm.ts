import { useMemo, useState } from 'react';

import type { ValidationError } from '@/shared/lib/validate';

/**
 * The smallest form controller that fixes audit 3.5.4 — "validation runs only
 * on submit, then gives up: the error clears on the first keystroke and is
 * never rechecked, so the user is never told they have fixed it."
 *
 * The fix is structural, not extra bookkeeping: errors are **derived on every
 * render** from the current values, and a field's error is *shown* once that
 * field has been touched or a submit has been attempted. So the message
 * survives typing, updates live, and disappears at the moment the value
 * actually becomes valid — never before.
 *
 * Dependency-free (no React Hook Form, no Zod requirement). Validators are the
 * pure functions from `@/shared/lib/validate`, or any function with the same
 * `(value, values) => string | undefined` shape.
 *
 * Declare the validator map at module level (not inline in the component) so
 * its identity is stable and the error memo actually memoises.
 */

/** One validator per field; a field with no entry is always valid. */
export type FormValidators<T> = {
  readonly [K in keyof T]?: (value: T[K], values: T) => ValidationError;
};

/** Internal mutable shapes; the public result exposes them as `Readonly`. */
type ErrorMap<T> = Partial<Record<keyof T, string>>;
type TouchedMap<T> = Partial<Record<keyof T, boolean>>;

export type FormErrors<T> = Readonly<ErrorMap<T>>;

export type FormTouched<T> = Readonly<TouchedMap<T>>;

export interface UseFormOptions<T extends object> {
  /** Starting values. Changing this later does not reset the form — call `reset`. */
  initial: T;
  validate?: FormValidators<T>;
  /** Runs only when every validator passes. May be async; `submitting` tracks it. */
  onSubmit?: (values: T) => void | Promise<void>;
}

export interface UseFormResult<T extends object> {
  values: T;
  /** Every currently failing field, whether or not it should be shown yet. */
  errors: FormErrors<T>;
  touched: FormTouched<T>;
  /** True once a submit has been attempted — after which all errors show. */
  submitted: boolean;
  /** True while an async `onSubmit` is in flight (wire to `Button busy`). */
  submitting: boolean;
  /** True when no validator fails. */
  isValid: boolean;
  /** True when at least one value differs from `initial`. */
  isDirty: boolean;
  /** Set one field (marks it touched, so its error re-checks from now on). */
  setField: <K extends keyof T>(key: K, value: T[K]) => void;
  /** Replace several fields at once. */
  setValues: (patch: Partial<T>) => void;
  /** Mark a field touched on blur, so its error appears without a submit. */
  blurField: (key: keyof T) => void;
  /** The message to render for a field — `undefined` until it should be shown. */
  errorFor: (key: keyof T) => string | undefined;
  /** Validate everything, reveal all errors, then call `onSubmit` if clean. */
  handleSubmit: () => void;
  /** Back to `next` (default: the original `initial`), errors and touches cleared. */
  reset: (next?: T) => void;
}

export function useForm<T extends object>({
  initial,
  validate,
  onSubmit,
}: UseFormOptions<T>): UseFormResult<T> {
  const [values, setValuesState] = useState<T>(initial);
  const [touched, setTouched] = useState<TouchedMap<T>>(() => ({}) as TouchedMap<T>);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // The baseline `isDirty` compares against; `reset(next)` moves it. Held as
  // state rather than a ref so `isDirty` can be derived during render.
  const [baseline, setBaseline] = useState<T>(initial);

  // Derived, never stored — this is what makes an error re-check on change.
  const errors = useMemo<ErrorMap<T>>(() => {
    const out = {} as ErrorMap<T>;
    if (!validate) return out;
    for (const key of Object.keys(validate) as (keyof T)[]) {
      const check = validate[key];
      if (!check) continue;
      const message = check(values[key], values);
      if (message) out[key] = message;
    }
    return out;
  }, [validate, values]);

  const isValid = Object.keys(errors).length === 0;

  const isDirty = useMemo(
    () => (Object.keys(values) as (keyof T)[]).some((k) => values[k] !== baseline[k]),
    [values, baseline],
  );

  const markTouched = (keys: readonly (keyof T)[]): void => {
    setTouched((t) => {
      if (keys.every((k) => t[k])) return t;
      const next: TouchedMap<T> = { ...t };
      for (const k of keys) next[k] = true;
      return next;
    });
  };

  const setField = <K extends keyof T>(key: K, value: T[K]): void => {
    setValuesState((v) => ({ ...v, [key]: value }));
    markTouched([key]);
  };

  const setValues = (patch: Partial<T>): void => {
    setValuesState((v) => ({ ...v, ...patch }));
    markTouched(Object.keys(patch) as (keyof T)[]);
  };

  const blurField = (key: keyof T): void => markTouched([key]);

  const errorFor = (key: keyof T): string | undefined =>
    submitted || touched[key] ? errors[key] : undefined;

  const handleSubmit = (): void => {
    setSubmitted(true);
    if (!isValid || !onSubmit) return;
    const result = onSubmit(values);
    if (result instanceof Promise) {
      setSubmitting(true);
      result.finally(() => setSubmitting(false));
    }
  };

  const reset = (next?: T): void => {
    const target = next ?? baseline;
    setBaseline(target);
    setValuesState(target);
    setTouched({} as TouchedMap<T>);
    setSubmitted(false);
    setSubmitting(false);
  };

  return {
    values,
    errors,
    touched,
    submitted,
    submitting,
    isValid,
    isDirty,
    setField,
    setValues,
    blurField,
    errorFor,
    handleSubmit,
    reset,
  };
}
