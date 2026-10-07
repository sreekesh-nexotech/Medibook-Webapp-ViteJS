import { useMemo, useState } from 'react';

import { isFailure } from '@/core/error/failure';

import { mapServerErrors, type ServerErrorOptions } from '@/shared/lib/serverErrors';
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
  /**
   * Show what the server rejected (UAT-48): each mapped field's first message
   * appears under that field (until the user edits it), the rest goes to
   * `serverSummary`. Returns the sentence to toast. Anything that is not a
   * `Failure` returns `fallback`.
   */
  applyServerErrors: (
    error: unknown,
    options?: ServerErrorOptions<FormFieldKey<T>>,
    fallback?: string,
  ) => string;
  /** Server messages that belong to no field on the form — render with `FormErrorSummary`. */
  serverSummary: readonly string[];
}

/** The string keys of a form's values — what server errors can be mapped onto. */
export type FormFieldKey<T> = Extract<keyof T, string>;

/** Toast text when a submit fails with something that is not a `Failure`. */
const SUBMIT_FAILED = 'Something went wrong. Please try again.';

export function useForm<T extends object>({
  initial,
  validate,
  onSubmit,
}: UseFormOptions<T>): UseFormResult<T> {
  const [values, setValuesState] = useState<T>(initial);
  const [touched, setTouched] = useState<TouchedMap<T>>(() => ({}) as TouchedMap<T>);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // What the server rejected on the last submit. A field's message is cleared
  // as soon as the user edits that field; client errors always win.
  const [serverErrors, setServerErrors] = useState<ErrorMap<T>>(() => ({}) as ErrorMap<T>);
  const [serverSummary, setServerSummary] = useState<readonly string[]>([]);

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

  const clearServerErrorsFor = (keys: readonly (keyof T)[]): void => {
    setServerErrors((current) => {
      if (!keys.some((k) => current[k] !== undefined)) return current;
      const next: ErrorMap<T> = { ...current };
      for (const k of keys) delete next[k];
      return next;
    });
  };

  const setField = <K extends keyof T>(key: K, value: T[K]): void => {
    setValuesState((v) => ({ ...v, [key]: value }));
    markTouched([key]);
    clearServerErrorsFor([key]);
  };

  const setValues = (patch: Partial<T>): void => {
    setValuesState((v) => ({ ...v, ...patch }));
    const keys = Object.keys(patch) as (keyof T)[];
    markTouched(keys);
    clearServerErrorsFor(keys);
  };

  const blurField = (key: keyof T): void => markTouched([key]);

  const errorFor = (key: keyof T): string | undefined =>
    (submitted || touched[key] ? errors[key] : undefined) ?? serverErrors[key];

  const applyServerErrors = (
    error: unknown,
    options?: ServerErrorOptions<FormFieldKey<T>>,
    fallback: string = SUBMIT_FAILED,
  ): string => {
    if (!isFailure(error)) return fallback;
    const mapped = mapServerErrors(error, options);
    setServerErrors({ ...mapped.fields } as ErrorMap<T>);
    setServerSummary(mapped.summary);
    return mapped.headline || fallback;
  };

  const handleSubmit = (): void => {
    setSubmitted(true);
    setServerErrors({} as ErrorMap<T>);
    setServerSummary([]);
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
    setServerErrors({} as ErrorMap<T>);
    setServerSummary([]);
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
    applyServerErrors,
    serverSummary,
  };
}
