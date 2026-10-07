/**
 * The Hospital Settings screen's editable draft, and the pure mapping between
 * it and the server records (module H2). The screen edits labels ("30 days",
 * "8:00 am") because that is what its selects offer; this module is the one
 * place those labels become the numbers and `HH:MM` times the API takes.
 *
 * Pure functions and constants only: no React, no store, no I/O.
 */

import type {
  BankAccount,
  BankAccountInput,
  HospitalHoursDay,
  HospitalProfile,
  HospitalProfileChanges,
  HospitalRuleChanges,
  HospitalRuleSettings,
  NumberingChanges,
  NumberingKind,
  NumberingReset,
  NumberingSeries,
  TokenPolicy,
  TokenPolicyChanges,
  TokenReset,
  TokenScope,
} from '@/features/settings/domain/entities/settings.entities';

import {
  durationCopy,
  minutesToTimeLabel,
  parseCount,
  parseDurationMinutes,
  parseTimeLabelMinutes,
} from './settings.rules';

/* ------------------------------------------------------------------ shapes */

export interface ProfileForm {
  readonly name: string;
  readonly email: string;
  readonly phone: string;
  /** Bound to `address_line1`. */
  readonly address: string;
  readonly city: string;
  readonly state: string;
  readonly pincode: string;
  readonly lat: string;
  readonly lng: string;
  readonly logoFileId: string | null;
  readonly coverFileId: string | null;
}

export interface HoursForm {
  readonly open: string;
  readonly close: string;
  /** Open flags Mon..Sun (7 entries). */
  readonly days: readonly boolean[];
}

export interface RulesForm {
  readonly horizon: string;
  readonly onlineApproval: boolean;
  readonly holdTimeout: string;
  readonly cancelBefore: string;
  /** "100%" … "0%". */
  readonly refundBefore: string;
  readonly refundAfter: string;
  readonly refundFee: boolean;
  readonly feeValidity: string;
  /** "3 missed calls". */
  readonly noShowCalls: string;
  /** "Until the token is called" / "30 min before the session". */
  readonly tokenCancel: string;
  /** Digits, 1–240. */
  readonly consultMinutes: string;
  readonly patientNotes: boolean;
  readonly patientEditApproval: boolean;
  readonly displayFullName: boolean;
}

export interface TokenForm {
  /** A `TOKEN_SCOPE_OPTIONS` label. */
  readonly scope: string;
  /** A `TOKEN_RESET_OPTIONS` label. */
  readonly reset: string;
  readonly format: string;
  readonly prefix: string;
  readonly onlineMarker: string;
  readonly offlineMarker: string;
  readonly separateRanges: boolean;
  readonly onlineFrom: string;
  readonly onlineTo: string;
  readonly walkInFrom: string;
  readonly walkInTo: string;
  readonly reuseCancelled: boolean;
}

/** One number series' draft (MRN, booking or receipt). */
export interface NumberingForm {
  readonly format: string;
  readonly prefix: string;
  /** Digits, 1–12. */
  readonly padWidth: string;
  /** A `NUMBERING_RESET_OPTIONS` label. */
  readonly reset: string;
  /** A month name. */
  readonly fyStartMonth: string;
}

export interface BankForm {
  readonly accountName: string;
  readonly bank: string;
  /** A NEW account number; empty keeps the stored one (it is never returned). */
  readonly account: string;
  readonly ifsc: string;
  readonly upi: string;
}

/**
 * One draft per backend resource, so each section saves on its own — each
 * number series is its own resource with its own version.
 */
export interface SettingsForm {
  readonly profile: ProfileForm;
  readonly hours: HoursForm;
  readonly rules: RulesForm;
  readonly token: TokenForm;
  readonly bank: BankForm;
  readonly mrn: NumberingForm;
  readonly booking: NumberingForm;
  readonly receipt: NumberingForm;
}

export type SettingsFormSection = keyof SettingsForm;

export const SETTINGS_FORM_SECTIONS: readonly SettingsFormSection[] = [
  'profile',
  'hours',
  'rules',
  'token',
  'bank',
  'mrn',
  'booking',
  'receipt',
];

/** The series this screen manages, in display order. */
export const NUMBERING_KINDS: readonly NumberingKind[] = ['mrn', 'booking', 'receipt'];

/* ----------------------------------------------------------------- helpers */

const DAYS_IN_WEEK = 7;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const HH_MM_PAD = 2;

/** Form defaults for a hospital whose hours were never set (the design's defaults). */
const DEFAULT_OPEN_LABEL = '8:00 am';
const DEFAULT_CLOSE_LABEL = '8:00 pm';

/**
 * Hold-timeout choices the backend accepts (2–15 minutes,
 * `HospitalSettingsUpdateRequest.hold_timeout_seconds`). Replaces the design's
 * 15/30/45 list, two of which the server would refuse.
 */
export const HOLD_TIMEOUT_SERVER_OPTIONS = ['5 mins', '10 mins', '15 mins'] as const;

/** Follow-up window bounds (`follow_up_window_days`, 0..365). */
export const FEE_VALIDITY_MAX_DAYS = 365;

/** `options` plus `value` when the server holds a value the list does not offer. */
export function withCurrent(options: readonly string[], value: string): readonly string[] {
  return value === '' || options.includes(value) ? options : [...options, value];
}

function sameJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** `edits` minus the sections in `saved` — those now match the server again. */
export function withoutSections(
  edits: Partial<SettingsForm>,
  saved: readonly SettingsFormSection[],
): Partial<SettingsForm> {
  const keep = (s: SettingsFormSection): boolean => !saved.includes(s);
  return {
    ...(edits.profile && keep('profile') && { profile: edits.profile }),
    ...(edits.hours && keep('hours') && { hours: edits.hours }),
    ...(edits.rules && keep('rules') && { rules: edits.rules }),
    ...(edits.token && keep('token') && { token: edits.token }),
    ...(edits.bank && keep('bank') && { bank: edits.bank }),
    ...(edits.mrn && keep('mrn') && { mrn: edits.mrn }),
    ...(edits.booking && keep('booking') && { booking: edits.booking }),
    ...(edits.receipt && keep('receipt') && { receipt: edits.receipt }),
  };
}

/** True when the section's draft differs from what the server holds. */
export function isSectionDirty(
  base: SettingsForm,
  draft: SettingsForm,
  section: SettingsFormSection,
): boolean {
  return !sameJson(base[section], draft[section]);
}

/* ------------------------------------------------------------------- phone */

const INDIA_DIAL_CODE = '+91';
const NATIONAL_DIGITS = 10;
const TRUNK_PREFIX = '0';

/** `+918045678900` → `8045678900`; other countries stay in E.164. */
export function phoneForDisplay(e164: string): string {
  const national = e164.startsWith(INDIA_DIAL_CODE) ? e164.slice(INDIA_DIAL_CODE.length) : null;
  return national !== null && national.length === NATIONAL_DIGITS ? national : e164;
}

/** `080 4567 8900` / `8045678900` → `+918045678900`; `+44…` keeps its own code. */
export function phoneToE164(input: string): string {
  const digits = input.replace(/\D/g, '');
  if (input.trim().startsWith('+')) return `+${digits}`;
  const national =
    digits.length === NATIONAL_DIGITS + 1 && digits.startsWith(TRUNK_PREFIX)
      ? digits.slice(1)
      : digits;
  return `${INDIA_DIAL_CODE}${national}`;
}

/* ----------------------------------------------------------------- profile */

function coordCopy(n: number | null): string {
  return n === null ? '' : String(n);
}

function coordValue(s: string): number | null {
  const trimmed = s.trim();
  if (trimmed === '') return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

export function toProfileForm(p: HospitalProfile): ProfileForm {
  return {
    name: p.name,
    email: p.email,
    phone: phoneForDisplay(p.phoneE164),
    address: p.addressLine1,
    city: p.city,
    state: p.state,
    pincode: p.pincode,
    lat: coordCopy(p.lat),
    lng: coordCopy(p.lng),
    logoFileId: p.logoFileId,
    coverFileId: p.coverFileId,
  };
}

/** Only the fields that changed, in API units. */
export function profileChanges(base: ProfileForm, draft: ProfileForm): HospitalProfileChanges {
  return {
    ...(draft.name !== base.name && { name: draft.name.trim() }),
    ...(draft.email !== base.email && { email: draft.email.trim() }),
    ...(draft.phone !== base.phone && { phoneE164: phoneToE164(draft.phone) }),
    ...(draft.address !== base.address && { addressLine1: draft.address.trim() }),
    ...(draft.city !== base.city && { city: draft.city.trim() }),
    ...(draft.state !== base.state && { state: draft.state.trim() }),
    ...(draft.pincode !== base.pincode && { pincode: draft.pincode.trim() }),
    ...(draft.lat !== base.lat && { lat: coordValue(draft.lat) }),
    ...(draft.lng !== base.lng && { lng: coordValue(draft.lng) }),
    ...(draft.logoFileId !== base.logoFileId && { logoFileId: draft.logoFileId }),
    ...(draft.coverFileId !== base.coverFileId && { coverFileId: draft.coverFileId }),
  };
}

/* ------------------------------------------------------------------- hours */

function hhmmToLabel(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  return minutesToTimeLabel((h ?? 0) * MINUTES_PER_HOUR + (m ?? 0));
}

function labelToHhmm(label: string): string {
  const total = parseTimeLabelMinutes(label);
  const h = Math.floor(total / MINUTES_PER_HOUR);
  const m = total % MINUTES_PER_HOUR;
  return `${String(h).padStart(HH_MM_PAD, '0')}:${String(m).padStart(HH_MM_PAD, '0')}`;
}

function openDaysOf(days: readonly HospitalHoursDay[]): readonly HospitalHoursDay[] {
  return days.filter((d) => !d.isClosed && d.opensAt !== null && d.closesAt !== null);
}

/**
 * The week as the screen shows it: one open/close pair (the first open day's)
 * and the Mon..Sun open flags. A weekday the server has no row for is closed.
 */
export function toHoursForm(days: readonly HospitalHoursDay[]): HoursForm {
  const first = openDaysOf(days)[0];
  const byWeekday = new Map(days.map((d) => [d.weekday, d]));
  return {
    open: first?.opensAt ? hhmmToLabel(first.opensAt) : DEFAULT_OPEN_LABEL,
    close: first?.closesAt ? hhmmToLabel(first.closesAt) : DEFAULT_CLOSE_LABEL,
    days: Array.from({ length: DAYS_IN_WEEK }, (_, i) => {
      const d = byWeekday.get(i);
      return d !== undefined && !d.isClosed;
    }),
  };
}

/** True when open days carry different times — saving makes them all the same. */
export function hasMixedHours(days: readonly HospitalHoursDay[]): boolean {
  const open = openDaysOf(days);
  return open.some((d) => d.opensAt !== open[0]?.opensAt || d.closesAt !== open[0]?.closesAt);
}

/** The full week the API takes: exactly one entry per weekday 0..6. */
export function hoursFromForm(form: HoursForm): readonly HospitalHoursDay[] {
  const opensAt = labelToHhmm(form.open);
  const closesAt = labelToHhmm(form.close);
  return Array.from({ length: DAYS_IN_WEEK }, (_, weekday) => {
    const isOpen = form.days[weekday] === true;
    return {
      weekday,
      isClosed: !isOpen,
      opensAt: isOpen ? opensAt : null,
      closesAt: isOpen ? closesAt : null,
    };
  });
}

/* ------------------------------------------------------------------- rules */

const BASIS_POINTS_PER_PERCENT = 100;
const UNTIL_CALLED = 'Until the token is called';
const UNTIL_SESSION_STARTS = 'Until the session starts';
const BEFORE_SESSION = 'before the session';
const MAX_NO_SHOW_CALLS = 10;
const TOKEN_CANCEL_CHOICES_MIN = [15, 30, 60, 120] as const;

/** Refund shares offered (`refund_*_cutoff_bp`, 0–10000). */
export const REFUND_OPTIONS = ['100%', '75%', '50%', '25%', '0%'] as const;

/** Expected consultation bounds (`expected_consult_minutes`, 1–240). */
export const CONSULT_MINUTES_MAX = 240;

function hoursLabel(hours: number): string {
  return hours === 1 ? '1 hour' : `${hours} hours`;
}

/** 10000 → "100%", 3333 → "33.33%". */
export function refundLabel(bp: number): string {
  const percent = bp / BASIS_POINTS_PER_PERCENT;
  return `${Number.isInteger(percent) ? percent : percent.toFixed(2)}%`;
}

function refundBp(label: string): number {
  const percent = Number.parseFloat(label);
  return Number.isFinite(percent) ? Math.round(percent * BASIS_POINTS_PER_PERCENT) : 0;
}

function noShowCallsLabel(calls: number): string {
  return calls === 1 ? '1 missed call' : `${calls} missed calls`;
}

/** Missed calls before the desk is offered a no-show (`no_show_call_attempts`, 1–10). */
export const NO_SHOW_CALL_OPTIONS: readonly string[] = Array.from(
  { length: MAX_NO_SHOW_CALLS },
  (_, i) => noShowCallsLabel(i + 1),
);

function tokenCancelLabel(minutes: number | null): string {
  if (minutes === null) return UNTIL_CALLED;
  if (minutes === 0) return UNTIL_SESSION_STARTS;
  return `${durationCopy(minutes)} ${BEFORE_SESSION}`;
}

/** How long a patient can cancel a token (`token_cancel_limit_min`, null or 0–1440). */
export const TOKEN_CANCEL_OPTIONS: readonly string[] = [
  UNTIL_CALLED,
  UNTIL_SESSION_STARTS,
  ...TOKEN_CANCEL_CHOICES_MIN.map(tokenCancelLabel),
];

/** "1 h 30 min before the session" → 90; the two fixed choices → null / 0. */
export function tokenCancelMinutes(label: string): number | null {
  if (label === UNTIL_CALLED) return null;
  if (label === UNTIL_SESSION_STARTS) return 0;
  const m = /^(?:(\d+) h)?\s*(?:(\d+) min)?/.exec(label);
  return Number(m?.[1] ?? 0) * MINUTES_PER_HOUR + Number(m?.[2] ?? 0);
}

export function toRulesForm(r: HospitalRuleSettings): RulesForm {
  return {
    horizon: `${r.bookingWindowDays} days`,
    onlineApproval: r.onlineRequiresApproval,
    holdTimeout: `${Math.round(r.holdTimeoutSeconds / SECONDS_PER_MINUTE)} mins`,
    cancelBefore: hoursLabel(r.cancellationCutoffHours),
    refundBefore: refundLabel(r.refundBeforeCutoffBp),
    refundAfter: refundLabel(r.refundAfterCutoffBp),
    refundFee: r.refundIncludesConvenienceFee,
    feeValidity: String(r.followUpWindowDays),
    noShowCalls: noShowCallsLabel(r.noShowCallAttempts),
    tokenCancel: tokenCancelLabel(r.tokenCancelLimitMin),
    consultMinutes: String(r.expectedConsultMinutes),
    patientNotes: r.patientNotesEnabled,
    patientEditApproval: r.patientEditRequiresApproval,
    displayFullName: r.displayShowFullName,
  };
}

/** Only the rules that changed, in API units. */
export function rulesChanges(base: RulesForm, draft: RulesForm): HospitalRuleChanges {
  const changed = (k: keyof RulesForm): boolean => draft[k] !== base[k];
  return {
    ...(changed('horizon') && { bookingWindowDays: parseCount(draft.horizon, 1) }),
    ...(changed('onlineApproval') && { onlineRequiresApproval: draft.onlineApproval }),
    ...(changed('holdTimeout') && {
      holdTimeoutSeconds: parseDurationMinutes(draft.holdTimeout, 0) * SECONDS_PER_MINUTE,
    }),
    ...(changed('cancelBefore') && {
      cancellationCutoffHours: parseDurationMinutes(draft.cancelBefore, 0) / MINUTES_PER_HOUR,
    }),
    ...(changed('refundBefore') && { refundBeforeCutoffBp: refundBp(draft.refundBefore) }),
    ...(changed('refundAfter') && { refundAfterCutoffBp: refundBp(draft.refundAfter) }),
    ...(changed('refundFee') && { refundIncludesConvenienceFee: draft.refundFee }),
    ...(changed('feeValidity') && { followUpWindowDays: parseCount(draft.feeValidity, 0) }),
    ...(changed('noShowCalls') && { noShowCallAttempts: parseCount(draft.noShowCalls, 1) }),
    ...(changed('tokenCancel') && { tokenCancelLimitMin: tokenCancelMinutes(draft.tokenCancel) }),
    ...(changed('consultMinutes') && {
      expectedConsultMinutes: parseCount(draft.consultMinutes, 1),
    }),
    ...(changed('patientNotes') && { patientNotesEnabled: draft.patientNotes }),
    ...(changed('patientEditApproval') && {
      patientEditRequiresApproval: draft.patientEditApproval,
    }),
    ...(changed('displayFullName') && { displayShowFullName: draft.displayFullName }),
  };
}

/* ------------------------------------------------------------ token policy */

const TOKEN_SCOPES: readonly (readonly [TokenScope, string])[] = [
  ['hospital', 'One series for the hospital'],
  ['department', 'One series per department'],
  ['doctor', 'One series per doctor'],
];

const TOKEN_RESETS: readonly (readonly [TokenReset, string])[] = [
  ['session', 'Every session'],
  ['day', 'Every day'],
];

export const TOKEN_SCOPE_OPTIONS: readonly string[] = TOKEN_SCOPES.map(([, label]) => label);
export const TOKEN_RESET_OPTIONS: readonly string[] = TOKEN_RESETS.map(([, label]) => label);

/** The label for a value; `pairs` lists every value, so the fallback never shows. */
function labelOf<K extends string>(pairs: readonly (readonly [K, string])[], key: K): string {
  return pairs.find(([k]) => k === key)?.[1] ?? key;
}

function keyOf<K extends string>(
  pairs: readonly (readonly [K, string])[],
  label: string,
): K | null {
  return pairs.find(([, l]) => l === label)?.[0] ?? null;
}

export function tokenScopeLabel(scope: TokenScope): string {
  return labelOf(TOKEN_SCOPES, scope);
}

export function tokenResetLabel(reset: TokenReset): string {
  return labelOf(TOKEN_RESETS, reset);
}

function numberCopy(n: number | null): string {
  return n === null ? '' : String(n);
}

function rangeValue(text: string): number | null {
  const t = text.trim();
  return t === '' ? null : Number(t);
}

/**
 * The policy as the screen edits it. Scope and reset show the value that will
 * apply (a pending change, if any), so choosing today's value again cancels it.
 */
export function toTokenForm(p: TokenPolicy): TokenForm {
  return {
    scope: tokenScopeLabel(p.pendingScope ?? p.scope),
    reset: tokenResetLabel(p.pendingReset ?? p.reset),
    format: p.format,
    prefix: p.prefix,
    onlineMarker: p.onlineMarker,
    offlineMarker: p.offlineMarker,
    separateRanges: p.separateRanges,
    onlineFrom: numberCopy(p.onlineRangeStart),
    onlineTo: numberCopy(p.onlineRangeEnd),
    walkInFrom: numberCopy(p.offlineRangeStart),
    walkInTo: numberCopy(p.offlineRangeEnd),
    reuseCancelled: p.reuseCancelled,
  };
}

/** Only the policy fields that changed, in API units. */
export function tokenChanges(base: TokenForm, draft: TokenForm): TokenPolicyChanges {
  const changed = (k: keyof TokenForm): boolean => draft[k] !== base[k];
  const scope = keyOf(TOKEN_SCOPES, draft.scope);
  const reset = keyOf(TOKEN_RESETS, draft.reset);
  return {
    ...(changed('scope') && scope && { scope }),
    ...(changed('reset') && reset && { reset }),
    ...(changed('format') && { format: draft.format.trim() }),
    ...(changed('prefix') && { prefix: draft.prefix.trim() }),
    ...(changed('onlineMarker') && { onlineMarker: draft.onlineMarker.trim() }),
    ...(changed('offlineMarker') && { offlineMarker: draft.offlineMarker.trim() }),
    ...(changed('separateRanges') && { separateRanges: draft.separateRanges }),
    ...(changed('onlineFrom') && { onlineRangeStart: rangeValue(draft.onlineFrom) }),
    ...(changed('onlineTo') && { onlineRangeEnd: rangeValue(draft.onlineTo) }),
    ...(changed('walkInFrom') && { offlineRangeStart: rangeValue(draft.walkInFrom) }),
    ...(changed('walkInTo') && { offlineRangeEnd: rangeValue(draft.walkInTo) }),
    ...(changed('reuseCancelled') && { reuseCancelled: draft.reuseCancelled }),
  };
}

/* --------------------------------------------------------------- numbering */

const NUMBERING_RESETS: readonly (readonly [NumberingReset, string])[] = [
  ['never', 'Never'],
  ['fiscal_year', 'Every financial year'],
  ['calendar_year', 'Every calendar year'],
  ['monthly', 'Every month'],
];

export const NUMBERING_RESET_OPTIONS: readonly string[] = NUMBERING_RESETS.map(([, l]) => l);

/** MRNs never restart (the backend refuses any other reset for them). */
export const MRN_RESET_OPTIONS: readonly string[] = [labelOf(NUMBERING_RESETS, 'never')];

export const MONTH_OPTIONS: readonly string[] = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export function isFiscalReset(label: string): boolean {
  return keyOf(NUMBERING_RESETS, label) === 'fiscal_year';
}

/** A blank draft, for a series the server did not list (it is never shown or saved). */
const EMPTY_NUMBERING_FORM: NumberingForm = {
  format: '',
  prefix: '',
  padWidth: '',
  reset: '',
  fyStartMonth: '',
};

export function toNumberingForm(series: NumberingSeries | undefined): NumberingForm {
  if (!series) return EMPTY_NUMBERING_FORM;
  return {
    format: series.format,
    prefix: series.prefix ?? '',
    padWidth: String(series.padWidth),
    reset: labelOf(NUMBERING_RESETS, series.reset),
    fyStartMonth: MONTH_OPTIONS[series.fyStartMonth - 1] ?? '',
  };
}

/** Only the series fields that changed, in API units. */
export function numberingChanges(base: NumberingForm, draft: NumberingForm): NumberingChanges {
  const changed = (k: keyof NumberingForm): boolean => draft[k] !== base[k];
  const reset = keyOf(NUMBERING_RESETS, draft.reset);
  const prefix = draft.prefix.trim();
  return {
    ...(changed('format') && { format: draft.format.trim() }),
    ...(changed('prefix') && { prefix: prefix === '' ? null : prefix }),
    ...(changed('padWidth') && { padWidth: parseCount(draft.padWidth, 1) }),
    ...(changed('reset') && reset && { reset }),
    ...(changed('fyStartMonth') && {
      fyStartMonth: MONTH_OPTIONS.indexOf(draft.fyStartMonth) + 1,
    }),
  };
}

/* -------------------------------------------------------------------- bank */

export function toBankForm(account: BankAccount | null): BankForm {
  return {
    accountName: account?.accountHolder ?? '',
    bank: account?.bankName ?? '',
    account: '',
    ifsc: account?.ifsc ?? '',
    upi: account?.upiId ?? '',
  };
}

/** The account to show and edit: the primary one, else the first. */
export function payoutAccountOf(accounts: readonly BankAccount[]): BankAccount | null {
  return accounts.find((a) => a.isPrimary) ?? accounts[0] ?? null;
}

export function bankInput(form: BankForm): BankAccountInput {
  const number = form.account.replace(/\s/g, '');
  const upi = form.upi.trim();
  return {
    accountHolder: form.accountName.trim(),
    ...(number !== '' && { accountNumber: number }),
    ifsc: form.ifsc.trim().toUpperCase(),
    bankName: form.bank.trim(),
    upiId: upi === '' ? null : upi,
  };
}
