/**
 * Server field errors → form fields and a summary (UAT-48).
 *
 * The backend answers a rejected write with `400 VALIDATION_ERROR` and an
 * `errors` object keyed by field (`core/exceptions.py`); `toFailure` flattens
 * it into `failure.fieldErrors` with dotted paths for nested serializers
 * (`booking.prefix`, `lines.1.amount_paise`). Before this helper every screen
 * toasted the envelope's "Some fields are invalid." and dropped the rest, so
 * nobody could tell which control to fix.
 *
 * `mapServerErrors` splits the messages in two:
 * - `fields` — the first message for each **form** field the server named,
 *   for `Field`'s `error` prop;
 * - `summary` — every message that belongs to no control on the form
 *   (`non_field_errors`, a header such as `If-Match`, a field the form does
 *   not show), labelled so it still reads on its own.
 *
 * Pure: no React, no stores. `useForm` wires it in through
 * `applyServerErrors`; screens with their own draft state call it directly.
 */

import type { Failure, FieldErrors } from '@/core/error/failure';
import { isFailure } from '@/core/error/failure';

/**
 * Server key (dotted path) → form field. A key also matches every path below
 * it, so `{ scopes: 'scopes' }` catches `scopes.1.service_id`; the longest
 * matching key wins. A function gets the full path and returns the field, or
 * `undefined` to leave the message to the summary.
 */
export type ServerFieldMap<K extends string> =
  Readonly<Record<string, K>> | ((serverKey: string) => K | undefined);

export interface ServerErrorOptions<K extends string> {
  /** Which server keys belong to which form fields. Omitted: none (summary only). */
  readonly fields?: ServerFieldMap<K>;
  /** Human names for server keys that end up in the summary (`{ code: 'Code' }`). */
  readonly labels?: Readonly<Record<string, string>>;
}

export interface MappedServerErrors<K extends string> {
  /** First message per form field the server rejected. */
  readonly fields: Readonly<Partial<Record<K, string>>>;
  /** Messages that belong to no control on the form, already labelled. */
  readonly summary: readonly string[];
  /** One sentence for a toast or a banner. */
  readonly headline: string;
  /** How many form fields carry a server message. */
  readonly fieldCount: number;
}

/** Keys DRF uses for errors that belong to the whole request, not one field. */
const REQUEST_LEVEL_KEYS: ReadonlySet<string> = new Set(['non_field_errors', 'detail', '__all__']);

/**
 * Request headers the backend validates like fields. Their raw messages
 * ("This header is required (the record version).") mean nothing to staff.
 */
const HEADER_MESSAGES: Readonly<Record<string, string>> = {
  'If-Match':
    'This record could not be saved because the page did not say which version you edited. Reload and try again.',
  'Idempotency-Key': 'The request could not be sent safely. Please try again.',
};

const PATH_SEPARATOR = '.';
const LABEL_JOINER = ' › ';
/** Shown when the server sent a validation error with nothing usable in it. */
const GENERIC_VALIDATION = 'Some details need fixing.';

/** `account_holder` → "Account holder"; list indexes become "item 2". */
function humanizeSegment(segment: string): string {
  if (/^\d+$/.test(segment)) return `item ${Number(segment) + 1}`;
  const words = segment.replace(/_/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** The label a summary line carries for `key` (longest labelled prefix, else humanized path). */
export function serverKeyLabel(key: string, labels: Readonly<Record<string, string>> = {}): string {
  const parts = key.split(PATH_SEPARATOR);
  for (let n = parts.length; n > 0; n -= 1) {
    const prefix = parts.slice(0, n).join(PATH_SEPARATOR);
    const label = labels[prefix];
    if (label !== undefined) {
      const rest = parts.slice(n).map(humanizeSegment);
      return [label, ...rest].join(LABEL_JOINER);
    }
  }
  return parts.map(humanizeSegment).join(LABEL_JOINER);
}

function resolveField<K extends string>(
  key: string,
  map: ServerFieldMap<K> | undefined,
): K | undefined {
  if (!map) return undefined;
  if (typeof map === 'function') return map(key);
  const parts = key.split(PATH_SEPARATOR);
  for (let n = parts.length; n > 0; n -= 1) {
    const field = map[parts.slice(0, n).join(PATH_SEPARATOR)];
    if (field !== undefined) return field;
  }
  return undefined;
}

function summaryLine(key: string, message: string, labels: Readonly<Record<string, string>>) {
  const header = HEADER_MESSAGES[key];
  if (header !== undefined) return header;
  if (REQUEST_LEVEL_KEYS.has(key)) return message;
  return `${serverKeyLabel(key, labels)}: ${message}`;
}

/** Split `fieldErrors` into form-field messages and labelled summary lines. */
export function mapFieldErrors<K extends string>(
  fieldErrors: FieldErrors,
  options: ServerErrorOptions<K> = {},
): Omit<MappedServerErrors<K>, 'headline'> {
  const labels = options.labels ?? {};
  const fields: Partial<Record<K, string>> = {};
  const summary: string[] = [];
  for (const [key, messages] of Object.entries(fieldErrors)) {
    const first = messages[0];
    if (first === undefined) continue;
    const field =
      HEADER_MESSAGES[key] === undefined ? resolveField(key, options.fields) : undefined;
    if (field !== undefined) {
      if (fields[field] === undefined) fields[field] = first;
      continue;
    }
    for (const message of messages) summary.push(summaryLine(key, message, labels));
  }
  return { fields, summary, fieldCount: Object.keys(fields).length };
}

/**
 * Map a failure onto a form. Non-validation failures (409, 403, network…)
 * carry no field errors: `fields` and `summary` are empty and `headline` is
 * the failure's own user-safe message.
 */
export function mapServerErrors<K extends string>(
  failure: Failure,
  options: ServerErrorOptions<K> = {},
): MappedServerErrors<K> {
  const mapped = mapFieldErrors(failure.fieldErrors, options);
  return { ...mapped, headline: headlineFor(failure, mapped, options.labels ?? {}) };
}

function headlineFor<K extends string>(
  failure: Failure,
  mapped: Omit<MappedServerErrors<K>, 'headline'>,
  labels: Readonly<Record<string, string>>,
): string {
  const { fieldCount, summary } = mapped;
  if (fieldCount === 0 && summary.length === 0) return failure.message;
  if (fieldCount === 0 && summary.length === 1) return summary[0] ?? failure.message;
  if (fieldCount === 0)
    return `${summary[0] ?? GENERIC_VALIDATION} (and ${summary.length - 1} more)`;
  const first = firstFieldLine(failure.fieldErrors, labels);
  const total = fieldCount + summary.length;
  return total === 1
    ? `Check the highlighted field — ${first}`
    : `Check the ${total} highlighted problems — ${first}`;
}

function firstFieldLine(fieldErrors: FieldErrors, labels: Readonly<Record<string, string>>) {
  for (const [key, messages] of Object.entries(fieldErrors)) {
    const first = messages[0];
    if (first !== undefined) return summaryLine(key, first, labels);
  }
  return GENERIC_VALIDATION;
}

/**
 * The sentence to toast for anything a mutation threw: a validation failure
 * names its first field ("Code: Already exists.") instead of the envelope's
 * "Some fields are invalid."; every other failure keeps its own message.
 */
export function describeFailure(
  error: unknown,
  fallback: string,
  labels: Readonly<Record<string, string>> = {},
): string {
  if (!isFailure(error)) return fallback;
  if (Object.keys(error.fieldErrors).length === 0) return error.message || fallback;
  const mapped = mapFieldErrors(error.fieldErrors, { labels });
  return mapped.summary.length > 1
    ? `${mapped.summary[0]} (and ${mapped.summary.length - 1} more)`
    : (mapped.summary[0] ?? error.message);
}
