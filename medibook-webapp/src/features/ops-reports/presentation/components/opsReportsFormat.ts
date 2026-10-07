/**
 * How platform report values and filters read on screen. The server sends
 * raw enum values, integer paise and ISO dates; this is the one place they
 * become text. Pure functions.
 */
import { fmtDate, money } from '@/shared/lib/format';

import type {
  OpsReportColumnKind,
  OpsReportFilter,
  OpsReportParams,
  OpsReportValue,
  ReportScheduleRunStatus,
} from '@/features/ops-reports/domain/entities/opsReports.types';

const EMPTY = '—';
const PAISE_PER_RUPEE = 100;
const BP_PER_PERCENT = 100;
const PERCENT_DECIMALS = 2;
const ISO_DATE_LENGTH = 10;
const ISO_TIME_START = 11;
const ISO_TIME_END = 16;

/** Readable labels for the raw enum values the platform reports carry. */
const VALUE_LABELS: Readonly<Record<string, string>> = {
  pending_approval: 'Pending approval',
  checked_in: 'Checked-in',
  in_consultation: 'In consultation',
  no_show: 'No-show',
  walk_in: 'Walk-in',
  captured: 'Paid',
  upi: 'UPI',
  emi: 'EMI',
  pos: 'POS',
  netbanking: 'Net banking',
  paylater: 'Pay later',
  on_hold: 'On hold',
};

const NUMERIC_KINDS: ReadonlySet<OpsReportColumnKind> = new Set(['int', 'paise', 'bp', 'percent']);

/** `no_show` → "No-show"; unknown values → sentence case with spaces. */
export function valueLabel(raw: string): string {
  const known = VALUE_LABELS[raw];
  if (known) return known;
  const spaced = raw.replaceAll('_', ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function isNumericKind(kind: OpsReportColumnKind): boolean {
  return NUMERIC_KINDS.has(kind);
}

/** One value as display text (money from integer paise). */
export function formatReportValue(value: OpsReportValue, kind: OpsReportColumnKind): string {
  if (value === null || value === '') return EMPTY;
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') {
    if (kind === 'paise') return money(value / PAISE_PER_RUPEE);
    if (kind === 'bp') return `${(value / BP_PER_PERCENT).toFixed(PERCENT_DECIMALS)}%`;
    if (kind === 'percent') return `${value.toFixed(PERCENT_DECIMALS)}%`;
    return value.toLocaleString('en-IN');
  }
  if (kind === 'date') return fmtDate(value.slice(0, ISO_DATE_LENGTH));
  if (kind === 'datetime') {
    return `${fmtDate(value.slice(0, ISO_DATE_LENGTH))}, ${value.slice(ISO_TIME_START, ISO_TIME_END)}`;
  }
  // Raw enum codes (snake_case, no spaces) read as labels; free text passes through.
  return /^[a-z][a-z0-9_]*$/.test(value) ? valueLabel(value) : value;
}

/* ----------------------------------------------------------------- filters */

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A filter's value problems before the run: bad ids and back-to-front ranges. */
export function validateReportParams(
  filters: readonly OpsReportFilter[],
  params: OpsReportParams,
): Readonly<Record<string, string>> {
  const errors: Record<string, string> = {};
  for (const f of filters) {
    if (f.kind === 'date_range') {
      const [fromParam, toParam] = f.params;
      const from = fromParam ? (params[fromParam] ?? '') : '';
      const to = toParam ? (params[toParam] ?? '') : '';
      if (from && to && from > to && toParam) {
        errors[toParam] = `${f.label}: the end is before the start.`;
      }
    } else if (f.kind === 'uuid') {
      const param = f.params[0];
      const value = param ? (params[param] ?? '').trim() : '';
      if (param && value && !UUID_PATTERN.test(value)) {
        errors[param] = `${f.label}: paste the full id (a UUID).`;
      }
    }
  }
  return errors;
}

/** Filters that are set, as "Booking date: 1 Oct 2026 – 7 Oct 2026 · Status: Completed". */
export function describeParams(
  filters: readonly OpsReportFilter[],
  params: OpsReportParams,
  nameOf: (filter: OpsReportFilter, value: string) => string = (_f, v) => v,
): string {
  const parts: string[] = [];
  for (const f of filters) {
    if (f.kind === 'date_range') {
      const [fromParam, toParam] = f.params;
      const from = fromParam ? params[fromParam] : '';
      const to = toParam ? params[toParam] : '';
      if (from || to) {
        parts.push(`${f.label}: ${from ? fmtDate(from) : 'start'} – ${to ? fmtDate(to) : 'today'}`);
      }
    } else {
      const param = f.params[0];
      const value = param ? params[param] : '';
      if (value) {
        parts.push(`${f.label}: ${f.kind === 'choice' ? valueLabel(value) : nameOf(f, value)}`);
      }
    }
  }
  return parts.length > 0 ? parts.join(' · ') : 'No filters — the whole platform history';
}

/** Field errors a run or export answered with (e.g. B7's date-span limit), as one line. */
export function fieldErrorLine(fieldErrors: Readonly<Record<string, readonly string[]>>): string {
  return Object.values(fieldErrors).flat().filter(Boolean).join(' ');
}

/* --------------------------------------------------------------- schedules */

export const RUN_STATUS_LOOK: Readonly<
  Record<ReportScheduleRunStatus, { readonly label: string; readonly badge: string }>
> = {
  sent: { label: 'Sent', badge: 'Sent' },
  skipped: { label: 'Skipped', badge: 'Paused' },
  failed: { label: 'Failed', badge: 'Failed' },
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Recipients box text → emails (lower-cased, de-duplicated), or the first invalid entry. */
export function parseRecipients(
  text: string,
): { readonly emails: readonly string[] } | { readonly invalid: string } {
  const parts = text
    .split(/[\s,;]+/)
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean);
  const invalid = parts.find((p) => !EMAIL_PATTERN.test(p));
  if (invalid !== undefined) return { invalid };
  return { emails: [...new Set(parts)] };
}

/** Most recipients a schedule may have (backend serializer). */
export const MAX_RECIPIENTS = 20;
