/**
 * Tiny pure field validators. Every one returns `undefined` when the value is
 * acceptable and a short, user-safe sentence when it is not — the exact shape
 * `Field`'s `error` prop and `useForm`'s validator map expect.
 *
 * No React, no stores, no Zod: these run on a single value and are safe to
 * call from anywhere (including render). Zod stays where the standards put it
 * — guarding API responses at the infrastructure boundary — but a schema-first
 * form can still reuse this module's error shape through `fieldErrors()`.
 *
 * See docs/REACT_VITEJS_CODING_STANDARDS.md 5 (layer rules) and 6 (errors).
 */
import type { ZodType } from 'zod';

/** What every validator returns: a message, or `undefined` when valid. */
export type ValidationError = string | undefined;

/** Indian mobile numbers: 10 digits starting 6-9, spaces/dashes tolerated. */
const PHONE_IN_DIGITS = 10;
const PINCODE_DIGITS = 6;
/** Indian PIN codes never start with 0. */
const PINCODE_PATTERN = /^[1-9][0-9]{5}$/;
const PHONE_IN_PATTERN = /^[6-9][0-9]{9}$/;
/** Deliberately permissive: one @, a dot-bearing domain, no whitespace. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Strip the separators humans type into phone / PIN fields. */
function digitsOnly(value: string): string {
  return value.replace(/[\s\-()+]/g, '');
}

/** Today at midnight, so "not in the future" treats today as allowed. */
function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Non-empty after trimming. `label` personalises the message. */
export function required(value: string | null | undefined, label = 'This field'): ValidationError {
  return value != null && value.trim() !== '' ? undefined : `${label} is required.`;
}

/** 10-digit Indian mobile starting 6-9. Rejects empty, letters and short input. */
export function phoneIN(value: string | null | undefined): ValidationError {
  const raw = (value ?? '').trim();
  if (raw === '') return 'Mobile number is required.';
  const digits = digitsOnly(raw);
  if (!/^[0-9]+$/.test(digits)) return 'Mobile number can only contain digits.';
  if (digits.length !== PHONE_IN_DIGITS) return `Enter a ${PHONE_IN_DIGITS}-digit mobile number.`;
  if (!PHONE_IN_PATTERN.test(digits)) return 'Mobile number must start with 6, 7, 8 or 9.';
  return undefined;
}

export function email(value: string | null | undefined): ValidationError {
  const raw = (value ?? '').trim();
  if (raw === '') return 'Email is required.';
  return EMAIL_PATTERN.test(raw) ? undefined : 'Enter a valid email address.';
}

/** 6-digit Indian PIN code, not starting with 0. */
export function pincode(value: string | null | undefined): ValidationError {
  const raw = (value ?? '').trim();
  if (raw === '') return 'PIN code is required.';
  const digits = digitsOnly(raw);
  if (!/^[0-9]+$/.test(digits)) return 'PIN code can only contain digits.';
  if (digits.length !== PINCODE_DIGITS) return `Enter a ${PINCODE_DIGITS}-digit PIN code.`;
  return PINCODE_PATTERN.test(digits) ? undefined : 'Enter a valid PIN code.';
}

/** At least `min` characters after trimming. */
export function minLen(
  value: string | null | undefined,
  min: number,
  label = 'This field',
): ValidationError {
  const raw = (value ?? '').trim();
  if (raw === '') return `${label} is required.`;
  return raw.length >= min ? undefined : `${label} must be at least ${min} characters.`;
}

/** A money/quantity field that must parse to a number greater than zero. */
export function positiveAmount(
  value: string | number | null | undefined,
  label = 'Amount',
): ValidationError {
  const raw = typeof value === 'number' ? String(value) : (value ?? '').trim();
  if (raw === '') return `${label} is required.`;
  const n = Number(raw);
  if (!Number.isFinite(n)) return `${label} must be a number.`;
  return n > 0 ? undefined : `${label} must be greater than zero.`;
}

/** An ISO `yyyy-mm-dd` date that is today or earlier (e.g. date of birth). */
export function notFutureDate(value: string | null | undefined, label = 'Date'): ValidationError {
  const raw = (value ?? '').trim();
  if (raw === '') return `${label} is required.`;
  if (!ISO_DATE_PATTERN.test(raw)) return `${label} must be a valid date.`;
  const d = new Date(`${raw}T00:00:00`);
  if (Number.isNaN(d.getTime())) return `${label} must be a valid date.`;
  return d.getTime() <= startOfToday().getTime() ? undefined : `${label} cannot be in the future.`;
}

/**
 * A `from`/`to` pair where both are ISO dates and `from` is not after `to`.
 * Returns the message against the *to* field, which is where the user fixes it.
 */
export function dateRange(
  from: string | null | undefined,
  to: string | null | undefined,
): ValidationError {
  const a = (from ?? '').trim();
  const b = (to ?? '').trim();
  if (a === '' || b === '') return 'Pick both a start and an end date.';
  if (!ISO_DATE_PATTERN.test(a) || !ISO_DATE_PATTERN.test(b)) return 'Enter valid dates.';
  return a <= b ? undefined : 'The end date must be on or after the start date.';
}

/**
 * Escape hatch for screens that would rather describe a whole form with a Zod
 * schema than a validator per field: parses `value` and flattens the issues
 * into the same `{ field: message }` map `useForm` produces, so both styles
 * feed `Field`'s `error` prop identically. Only the first issue per field is
 * kept — that is all one field can show.
 */
export function fieldErrors<T>(
  schema: ZodType<T>,
  value: unknown,
): Readonly<Record<string, string>> {
  const result = schema.safeParse(value);
  if (result.success) return {};
  const out: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = issue.path.map(String).join('.');
    if (key !== '' && !(key in out)) out[key] = issue.message;
  }
  return out;
}
