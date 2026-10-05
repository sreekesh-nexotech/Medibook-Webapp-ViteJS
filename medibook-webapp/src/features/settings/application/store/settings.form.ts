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
  TokenScope,
} from '@/features/settings/domain/entities/settings.entities';

import {
  CANONICAL_TOKEN_SCHEME,
  TOKEN_SCHEME_OPTIONS,
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
  readonly cancelBefore: string;
  readonly holdTimeout: string;
  readonly feeValidity: string;
}

export interface TokenForm {
  readonly scheme: string;
}

export interface BankForm {
  readonly accountName: string;
  readonly bank: string;
  /** A NEW account number; empty keeps the stored one (it is never returned). */
  readonly account: string;
  readonly ifsc: string;
  readonly upi: string;
}

/** One draft per backend resource, so each section saves on its own. */
export interface SettingsForm {
  readonly profile: ProfileForm;
  readonly hours: HoursForm;
  readonly rules: RulesForm;
  readonly token: TokenForm;
  readonly bank: BankForm;
}

export type SettingsFormSection = keyof SettingsForm;

export const SETTINGS_FORM_SECTIONS: readonly SettingsFormSection[] = [
  'profile',
  'hours',
  'rules',
  'token',
  'bank',
];

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

function hoursLabel(hours: number): string {
  return hours === 1 ? '1 hour' : `${hours} hours`;
}

export function toRulesForm(r: HospitalRuleSettings): RulesForm {
  return {
    horizon: `${r.bookingWindowDays} days`,
    cancelBefore: hoursLabel(r.cancellationCutoffHours),
    holdTimeout: `${Math.round(r.holdTimeoutSeconds / SECONDS_PER_MINUTE)} mins`,
    feeValidity: String(r.followUpWindowDays),
  };
}

/** Only the rules that changed, in API units. */
export function rulesChanges(base: RulesForm, draft: RulesForm): HospitalRuleChanges {
  return {
    ...(draft.horizon !== base.horizon && { bookingWindowDays: parseCount(draft.horizon, 1) }),
    ...(draft.cancelBefore !== base.cancelBefore && {
      cancellationCutoffHours: parseDurationMinutes(draft.cancelBefore, 0) / MINUTES_PER_HOUR,
    }),
    ...(draft.holdTimeout !== base.holdTimeout && {
      holdTimeoutSeconds: parseDurationMinutes(draft.holdTimeout, 0) * SECONDS_PER_MINUTE,
    }),
    ...(draft.feeValidity !== base.feeValidity && {
      followUpWindowDays: parseCount(draft.feeValidity, 0),
    }),
  };
}

/* ------------------------------------------------------------- token scope */

/** The per-doctor series exists server-side but was never in the design's list. */
const PER_DOCTOR_SCHEME = 'Per-doctor running (T-001)';

const SCHEME_FOR_SCOPE: Readonly<Record<TokenScope, string>> = {
  hospital: CANONICAL_TOKEN_SCHEME,
  department: TOKEN_SCHEME_OPTIONS[1],
  doctor: PER_DOCTOR_SCHEME,
};

export function schemeForScope(scope: TokenScope): string {
  return SCHEME_FOR_SCOPE[scope];
}

export function scopeForScheme(scheme: string): TokenScope {
  if (scheme === SCHEME_FOR_SCOPE.department) return 'department';
  if (scheme === SCHEME_FOR_SCOPE.doctor) return 'doctor';
  return 'hospital';
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
