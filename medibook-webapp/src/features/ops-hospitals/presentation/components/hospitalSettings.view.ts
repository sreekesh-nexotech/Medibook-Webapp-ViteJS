import type {
  NumberingEditableBy,
  NumberingKind,
  NumberingReset,
  TokenReset,
  TokenScope,
} from '@/features/ops-hospitals/domain/entities/hospitalSettings.entity';

/** Display vocabulary for the numbering and token-policy override cards. */

export const NUMBERING_KINDS: readonly NumberingKind[] = ['mrn', 'booking', 'receipt'];

export const NUMBERING_KIND_LABEL: Readonly<Record<NumberingKind, string>> = {
  mrn: 'MR number',
  booking: 'Booking reference',
  receipt: 'Receipt number',
};

export const NUMBERING_RESET_LABEL: Readonly<Record<NumberingReset, string>> = {
  never: 'Never',
  fiscal_year: 'Every financial year',
  calendar_year: 'Every calendar year',
  monthly: 'Every month',
};

export const NUMBERING_EDITABLE_LABEL: Readonly<Record<NumberingEditableBy, string>> = {
  platform: 'Medibook operations only',
  hospital_admin: 'Hospital administrator (with warning)',
  none: 'Nobody',
};

/** O-01: the default scope is `doctor`; department and hospital are configurable. */
export const TOKEN_SCOPE_LABEL: Readonly<Record<TokenScope, string>> = {
  doctor: 'Per doctor (default)',
  department: 'Per department',
  hospital: 'Whole hospital',
};

export const TOKEN_RESET_LABEL: Readonly<Record<TokenReset, string>> = {
  session: 'Every session',
  day: 'Every day',
};

/** A server value in its label, or the raw value when this build does not know it. */
export function labelOf<K extends string>(
  labels: Readonly<Record<K, string>>,
  value: string,
): string {
  return (labels as Readonly<Record<string, string>>)[value] ?? value;
}

/** `value` as one of the known keys, or `undefined` when this build does not know it. */
export function knownKey<K extends string>(
  labels: Readonly<Record<K, string>>,
  value: string,
): K | undefined {
  return (Object.keys(labels) as K[]).find((k) => k === value);
}

/** The key whose label is `label` (Select hands back labels). */
export function keyOfLabel<K extends string>(
  labels: Readonly<Record<K, string>>,
  label: string,
): K | undefined {
  return (Object.keys(labels) as K[]).find((k) => labels[k] === label);
}

/** Tokens a numbering format may use (D-26, `numbering.SERIES_TOKENS`). */
const NUMBERING_TOKEN = /^\{(PREFIX|SEQ(:\d{1,2})?|FY|YY|YYYY|MM)\}$/;
const ANY_TOKEN = /\{[^}]*\}/g;
const SEQ_WIDTH = /^\{SEQ:(\d+)\}$/;

/**
 * Client-side check of a numbering format before it is sent: known tokens
 * only, exactly one `{SEQ:n}` with n from 1 to 12, balanced braces. The
 * server re-validates (`numbering.validate_format`). `null` when it may be sent.
 */
export function numberingFormatProblem(format: string): string | null {
  const value = format.trim();
  if (!value) return 'Enter a format.';
  const tokens = value.match(ANY_TOKEN) ?? [];
  const unknown = tokens.filter((t) => !NUMBERING_TOKEN.test(t));
  if (unknown.length > 0) return `Unknown token ${unknown[0]}.`;
  const seq = tokens.filter((t) => t.startsWith('{SEQ'));
  if (seq.length !== 1) return 'Use exactly one {SEQ:n}.';
  const width = SEQ_WIDTH.exec(seq[0]);
  if (width && (Number(width[1]) < 1 || Number(width[1]) > 12)) {
    return '{SEQ:n} takes a width from 1 to 12.';
  }
  if (value.replace(ANY_TOKEN, '').match(/[{}]/)) return 'A brace is not closed.';
  return null;
}

/** Tokens a token-label format may use (D-15, §5.4). */
const TOKEN_LABEL_TOKEN = /^\{(PREFIX|SRC|SEQ(:\d{1,2})?|DOC|DEPT|DATE:DDMM)\}$/;

/** Same idea for the token label format. `null` when it may be sent. */
export function tokenFormatProblem(format: string): string | null {
  const value = format.trim();
  if (!value) return 'Enter a format.';
  const tokens = value.match(ANY_TOKEN) ?? [];
  const unknown = tokens.filter((t) => !TOKEN_LABEL_TOKEN.test(t));
  if (unknown.length > 0) return `Unknown token ${unknown[0]}.`;
  if (tokens.filter((t) => t.startsWith('{SEQ')).length !== 1) return 'Use exactly one {SEQ:n}.';
  if (value.replace(ANY_TOKEN, '').match(/[{}]/)) return 'A brace is not closed.';
  return null;
}

/** H-02: a booking ref starts with its hospital's prefix and a non-alphanumeric separator. */
const BOOKING_FORMAT_START = /^\{PREFIX\}[^A-Za-z0-9{]/;

/** The booking-specific shape rule (`numbering.booking_errors`); `null` when it holds. */
export function bookingFormatProblem(format: string): string | null {
  return BOOKING_FORMAT_START.test(format.trim())
    ? null
    : 'A booking format must start with {PREFIX} and a separator, e.g. {PREFIX}-{YY}-{SEQ:6}.';
}
