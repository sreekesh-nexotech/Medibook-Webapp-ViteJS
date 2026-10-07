/**
 * Pure rules for Hospital Settings: how token labels and numbering series
 * render, which formats the backend accepts, and the unit conversions the
 * form needs (percent ↔ basis points). Every rule mirrors the backend so the
 * screen can say what a change will do before it is saved — and never shows
 * a label the server would not issue (UAT-27).
 *
 * Pure functions and constants only: no React, no store, no I/O.
 */

import { parseHundredths } from '@/shared/lib/format';

/* -------------------------------------------------------------- formatting */

const MINUTES_PER_HOUR = 60;

/** A duration in minutes as readable copy: 90 -> "1 h 30 min", 60 -> "1 h". */
export function durationCopy(minutes: number): string {
  if (minutes < MINUTES_PER_HOUR) return `${minutes} min`;
  const h = Math.floor(minutes / MINUTES_PER_HOUR);
  const m = minutes % MINUTES_PER_HOUR;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/* ------------------------------------------------------------ percentages */

const BP_PER_PERCENT = 100;
const MAX_BP = 10_000;

/** 10000 bp -> "100", 2550 -> "25.5" (what a percent input shows). */
export function bpToPercentInput(bp: number): string {
  const whole = Math.trunc(bp / BP_PER_PERCENT);
  const rest = bp % BP_PER_PERCENT;
  if (rest === 0) return String(whole);
  return `${whole}.${String(rest).padStart(2, '0').replace(/0$/, '')}`;
}

/** "25.5" -> 2550 bp; `null` for anything that is not a 0–100 percentage. */
export function percentInputToBp(text: string): number | null {
  const bp = parseHundredths(text);
  return bp !== null && bp <= MAX_BP ? bp : null;
}

/* ------------------------------------------------------------ token labels */

/** Placeholders a token label may use (`allocator.LABEL_TOKENS`). */
export const TOKEN_LABEL_TOKENS = ['PREFIX', 'SEQ', 'SRC', 'DOC', 'DEPT', 'DATE'] as const;

/** Placeholders a numbering series may use (`numbering.SERIES_TOKENS`). */
export const NUMBERING_TOKENS = ['PREFIX', 'SEQ', 'FY', 'YY', 'YYYY', 'MM'] as const;

const PLACEHOLDER_PATTERN = /\{([A-Z]+)(?::(\w+))?\}/g;
const MAX_SEQ_PAD = 12;

/**
 * Why `format` would be refused, or `undefined` when it can be saved: only
 * the allowed placeholders, exactly one `{SEQ}` / `{SEQ:n}` (1 ≤ n ≤ 12),
 * and no stray braces (`numbering.validate_format`). Token labels get the
 * same checks — `allocator.validate_label_format` is looser, but a stray
 * brace or a 20-digit number would print on every slip.
 */
export function formatError(format: string, allowed: readonly string[]): string | undefined {
  const value = format.trim();
  if (value === '') return 'Enter a format, e.g. {SRC}{SEQ:3}.';
  const found = [...value.matchAll(PLACEHOLDER_PATTERN)];
  const unknown = [...new Set(found.map((m) => m[1] ?? '').filter((n) => !allowed.includes(n)))];
  if (unknown.length > 0) return `Unknown placeholder: ${unknown.map((n) => `{${n}}`).join(', ')}.`;
  const seq = found.filter((m) => m[1] === 'SEQ');
  if (seq.length !== 1) return 'The format needs exactly one {SEQ} or {SEQ:n}.';
  const pad = seq[0]?.[2];
  if (pad !== undefined && !(/^\d+$/.test(pad) && Number(pad) >= 1 && Number(pad) <= MAX_SEQ_PAD)) {
    return `{SEQ:n} needs n between 1 and ${MAX_SEQ_PAD}.`;
  }
  const rest = value.replace(PLACEHOLDER_PATTERN, '');
  return rest.includes('{') || rest.includes('}') ? 'Check the braces in the format.' : undefined;
}

/** What one token label is made of — the draft policy plus a sample booking. */
export interface TokenSampleInput {
  readonly format: string;
  readonly prefix: string;
  readonly onlineMarker: string;
  readonly offlineMarker: string;
  readonly seq: number;
  readonly source: 'online' | 'desk';
  /** The doctor's short code (`slug`), upper-cased like the backend does. */
  readonly doctorCode: string;
  readonly departmentCode: string;
  /** ISO `yyyy-mm-dd`. */
  readonly date: string;
}

function datePart(pattern: string, isoDate: string): string {
  const [yyyy = '', mm = '', dd = ''] = isoDate.split('-');
  return pattern
    .replace('YYYY', yyyy)
    .replace('YY', yyyy.slice(-2))
    .replace('MM', mm)
    .replace('DD', dd);
}

/**
 * The label the backend would print for one token (`allocator.render_label`).
 * `{SEQ}` without a width is not padded; `{DOC}`/`{DEPT}` are the doctor
 * slug and department code in capitals; `{DATE}` defaults to `DDMM`.
 */
export function renderTokenLabel(input: TokenSampleInput): string {
  return input.format.replace(PLACEHOLDER_PATTERN, (whole, name: string, arg?: string) => {
    switch (name) {
      case 'SEQ':
        return arg && /^\d+$/.test(arg)
          ? String(input.seq).padStart(Number(arg), '0')
          : String(input.seq);
      case 'PREFIX':
        return input.prefix;
      case 'SRC':
        return input.source === 'online' ? input.onlineMarker : input.offlineMarker;
      case 'DOC':
        return input.doctorCode.toUpperCase();
      case 'DEPT':
        return input.departmentCode.toUpperCase();
      case 'DATE':
        return datePart(arg ?? 'DDMM', input.date);
      default:
        return whole;
    }
  });
}

/** True when two departments' tokens would read alike (no `{DEPT}`/`{DOC}` in the label). */
export function labelsCollideAcrossDepartments(format: string): boolean {
  return !/\{(DEPT|DOC)\}/.test(format);
}

/** True when online and desk tokens read differently (`{SRC}` with distinct markers). */
export function labelShowsSource(format: string, online: string, desk: string): boolean {
  return /\{SRC\}/.test(format) && online !== desk;
}

/* --------------------------------------------------------------- numbering */

export interface NumberingSampleInput {
  readonly format: string;
  readonly prefix: string | null;
  readonly padWidth: number;
  /** 1 = January; the fiscal year starts on the first of this month. */
  readonly fyStartMonth: number;
  readonly seq: number;
  /** ISO `yyyy-mm-dd`. */
  readonly date: string;
}

const TWO_DIGITS = 2;

/** "26-27" for 2026-10-07 with an April start (`numbering.fy_label`). */
export function fiscalYearToken(isoDate: string, fyStartMonth: number): string {
  const [y = 0, m = 1] = isoDate.split('-').map(Number);
  const start = m >= fyStartMonth ? y : y - 1;
  const end = start + 1;
  const pad = (n: number) => String(n % 100).padStart(TWO_DIGITS, '0');
  return `${pad(start)}-${pad(end)}`;
}

/** A number as the backend would issue it from this format (`numbering.render`). */
export function renderNumberingSample(input: NumberingSampleInput): string {
  const [yyyy = '', mm = ''] = input.date.split('-');
  return input.format.replace(PLACEHOLDER_PATTERN, (whole, name: string, arg?: string) => {
    switch (name) {
      case 'SEQ':
        return String(input.seq).padStart(arg ? Number(arg) : input.padWidth, '0');
      case 'PREFIX':
        return input.prefix ?? '';
      case 'FY':
        return fiscalYearToken(input.date, input.fyStartMonth);
      case 'YY':
        return yyyy.slice(-2);
      case 'YYYY':
        return yyyy;
      case 'MM':
        return mm;
      default:
        return whole;
    }
  });
}
