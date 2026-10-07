/**
 * The Hospital Settings screen's editable draft, and the pure mapping between
 * it and the server records (module H2). One draft per backend resource —
 * profile, rulebook, hours, token policy — so each saves on its own and
 * switching sections keeps every edit (07·F10).
 *
 * Pure functions and constants only: no React, no store, no I/O.
 */

import { minutesToTimeLabel, timeLabelToMinutes } from '@/features/doctors/domain/calendar';
import type {
  BankAccount,
  BankAccountInput,
  HospitalHoursDay,
  HospitalProfile,
  HospitalProfileChanges,
  HospitalRuleChanges,
  HospitalRuleSettings,
  ReceiptPaper,
  TokenPolicy,
  TokenPolicyChanges,
  TokenReset,
  TokenScope,
} from '@/features/settings/domain/entities/settings.entities';

import {
  bpToPercentInput,
  formatError,
  percentInputToBp,
  TOKEN_LABEL_TOKENS,
} from './settings.rules';

/* ------------------------------------------------------------------ shapes */

export interface ProfileForm {
  readonly name: string;
  readonly legalName: string;
  readonly email: string;
  readonly phone: string;
  readonly website: string;
  readonly address1: string;
  readonly address2: string;
  readonly address3: string;
  readonly city: string;
  readonly state: string;
  readonly pincode: string;
  readonly lat: string;
  readonly lng: string;
  readonly logoFileId: string | null;
  readonly coverFileId: string | null;
  readonly stampFileId: string | null;
}

/** One weekday: open or closed, and its own hours (07·F14, UAT-50). */
export interface HoursDayForm {
  readonly open: boolean;
  /** Time labels ("9:00 am"). */
  readonly from: string;
  readonly to: string;
}

export interface HoursForm {
  /** Mon..Sun (7 entries). */
  readonly days: readonly HoursDayForm[];
}

/** The rulebook as the form edits it: numbers are text until saved, switches are booleans. */
export interface RulesForm {
  readonly bookingWindowDays: string;
  readonly onlineRequiresApproval: boolean;
  readonly holdTimeoutMinutes: string;
  readonly cancellationCutoffHours: string;
  readonly refundBeforePct: string;
  readonly refundAfterPct: string;
  readonly refundIncludesConvenienceFee: boolean;
  readonly followUpWindowDays: string;
  readonly noShowCallAttempts: string;
  /** Empty = tokens can be cancelled until they are called. */
  readonly tokenCancelLimitMin: string;
  readonly expectedConsultMinutes: string;
  readonly patientNotesEnabled: boolean;
  readonly receiptPaper: ReceiptPaper;
  readonly receiptShowStaff: boolean;
  readonly patientEditRequiresApproval: boolean;
  readonly displayShowFullName: boolean;
  /** `null` while the backend does not offer the setting (APPT-03). */
  readonly deskPaymentMethods: readonly string[] | null;
}

export interface TokenForm {
  /** Starts at the pending value when a change is scheduled (07·F4). */
  readonly scope: TokenScope;
  readonly reset: TokenReset;
  readonly format: string;
  readonly prefix: string;
  readonly onlineMarker: string;
  readonly offlineMarker: string;
  readonly separateRanges: boolean;
  readonly onlineRangeStart: string;
  readonly onlineRangeEnd: string;
  readonly offlineRangeStart: string;
  readonly offlineRangeEnd: string;
  readonly reuseCancelled: boolean;
  /** Empty = the hospital's default token-slip template. */
  readonly printTemplateId: string;
}

/** One draft per backend resource, so each section saves on its own. */
export interface SettingsForm {
  readonly profile: ProfileForm;
  readonly hours: HoursForm;
  readonly rules: RulesForm;
  readonly token: TokenForm;
}

export type SettingsFormSection = keyof SettingsForm;

export const SETTINGS_FORM_SECTIONS: readonly SettingsFormSection[] = [
  'profile',
  'hours',
  'rules',
  'token',
];

/* ----------------------------------------------------------------- helpers */

const DAYS_IN_WEEK = 7;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const HH_MM_PAD = 2;

/** Form defaults for a weekday the server has no hours for. */
const DEFAULT_OPEN_LABEL = '9:00 am';
const DEFAULT_CLOSE_LABEL = '6:00 pm';

/** Backend bounds (`HospitalSettingsUpdateSerializer`). */
export const RULE_BOUNDS = {
  bookingWindowDays: { min: 1, max: 180 },
  holdTimeoutMinutes: { min: 2, max: 15 },
  cancellationCutoffHours: { min: 0, max: 720 },
  followUpWindowDays: { min: 0, max: 365 },
  noShowCallAttempts: { min: 1, max: 10 },
  tokenCancelLimitMin: { min: 0, max: 1440 },
  expectedConsultMinutes: { min: 1, max: 240 },
} as const;

/** Hold-timeout choices, whole minutes the backend accepts (2–15). */
export const HOLD_TIMEOUT_OPTIONS: readonly string[] = Array.from(
  { length: RULE_BOUNDS.holdTimeoutMinutes.max - RULE_BOUNDS.holdTimeoutMinutes.min + 1 },
  (_, i) => String(RULE_BOUNDS.holdTimeoutMinutes.min + i),
);

/** No-show offer after 1–10 skips (Q27). */
export const NO_SHOW_ATTEMPT_OPTIONS: readonly string[] = Array.from(
  { length: RULE_BOUNDS.noShowCallAttempts.max },
  (_, i) => String(i + 1),
);

export const RECEIPT_PAPER_OPTIONS: readonly ReceiptPaper[] = ['A5', '80mm', 'A4'];

/** Desk methods a hospital can accept (`Payment.Method` minus online-only ones). */
export const DESK_PAYMENT_METHODS: readonly { readonly value: string; readonly label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'card', label: 'Card' },
  { value: 'pos', label: 'POS terminal' },
  { value: 'other', label: 'Other' },
];

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

/** The rulebook fields whose draft differs from the server. */
export function dirtyRuleFields(base: RulesForm, draft: RulesForm): readonly (keyof RulesForm)[] {
  return (Object.keys(draft) as (keyof RulesForm)[]).filter((k) => !sameJson(base[k], draft[k]));
}

function intText(n: number | null): string {
  return n === null ? '' : String(n);
}

function textInt(s: string): number | null {
  const t = s.trim();
  return /^\d+$/.test(t) ? Number(t) : null;
}

/** A whole number in `[min, max]`, or the reason it is not. */
export function boundedIntError(
  text: string,
  label: string,
  { min, max }: { readonly min: number; readonly max: number },
): string | undefined {
  const n = textInt(text);
  if (n === null) return `${label} must be a whole number.`;
  return n >= min && n <= max ? undefined : `${label} must be between ${min} and ${max}.`;
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

/** Optional text: blank is sent as `null` (the backend stores no empty strings). */
function optionalText(s: string): string | null {
  const t = s.trim();
  return t === '' ? null : t;
}

export function toProfileForm(p: HospitalProfile): ProfileForm {
  return {
    name: p.name,
    legalName: p.legalName ?? '',
    email: p.email,
    phone: phoneForDisplay(p.phoneE164),
    website: p.website ?? '',
    address1: p.addressLine1,
    address2: p.addressLine2 ?? '',
    address3: p.addressLine3 ?? '',
    city: p.city,
    state: p.state,
    pincode: p.pincode,
    lat: coordCopy(p.lat),
    lng: coordCopy(p.lng),
    logoFileId: p.logoFileId,
    coverFileId: p.coverFileId,
    stampFileId: p.stampFileId,
  };
}

/**
 * Only the fields that changed, in API units. Coordinates are sent only
 * when the user typed them — nothing on this screen invents a location
 * (07·F1, UAT-28).
 */
export function profileChanges(base: ProfileForm, draft: ProfileForm): HospitalProfileChanges {
  return {
    ...(draft.name !== base.name && { name: draft.name.trim() }),
    ...(draft.legalName !== base.legalName && { legalName: optionalText(draft.legalName) }),
    ...(draft.email !== base.email && { email: draft.email.trim() }),
    ...(draft.phone !== base.phone && { phoneE164: phoneToE164(draft.phone) }),
    ...(draft.website !== base.website && { website: optionalText(draft.website) }),
    ...(draft.address1 !== base.address1 && { addressLine1: draft.address1.trim() }),
    ...(draft.address2 !== base.address2 && { addressLine2: optionalText(draft.address2) }),
    ...(draft.address3 !== base.address3 && { addressLine3: optionalText(draft.address3) }),
    ...(draft.city !== base.city && { city: draft.city.trim() }),
    ...(draft.state !== base.state && { state: draft.state.trim() }),
    ...(draft.pincode !== base.pincode && { pincode: draft.pincode.trim() }),
    ...(draft.lat !== base.lat && { lat: coordValue(draft.lat) }),
    ...(draft.lng !== base.lng && { lng: coordValue(draft.lng) }),
    ...(draft.logoFileId !== base.logoFileId && { logoFileId: draft.logoFileId }),
    ...(draft.coverFileId !== base.coverFileId && { coverFileId: draft.coverFileId }),
    ...(draft.stampFileId !== base.stampFileId && { stampFileId: draft.stampFileId }),
  };
}

/* ------------------------------------------------------------------- hours */

function hhmmToLabel(hhmm: string): string {
  return minutesToTimeLabel(timeLabelToMinutes(hhmm) ?? 0);
}

function labelToHhmm(label: string): string | null {
  const total = timeLabelToMinutes(label);
  if (total === null) return null;
  const h = Math.floor(total / MINUTES_PER_HOUR);
  const m = total % MINUTES_PER_HOUR;
  return `${String(h).padStart(HH_MM_PAD, '0')}:${String(m).padStart(HH_MM_PAD, '0')}`;
}

/** The week as the screen edits it — each weekday its own hours. Missing days are closed. */
export function toHoursForm(days: readonly HospitalHoursDay[]): HoursForm {
  const byWeekday = new Map(days.map((d) => [d.weekday, d]));
  return {
    days: Array.from({ length: DAYS_IN_WEEK }, (_, i) => {
      const d = byWeekday.get(i);
      const open = d !== undefined && !d.isClosed && d.opensAt !== null && d.closesAt !== null;
      return {
        open,
        from: d?.opensAt ? hhmmToLabel(d.opensAt) : DEFAULT_OPEN_LABEL,
        to: d?.closesAt ? hhmmToLabel(d.closesAt) : DEFAULT_CLOSE_LABEL,
      };
    }),
  };
}

/** Per-day problems (index → message): an open day must close after it opens. */
export function hoursErrors(form: HoursForm): Readonly<Record<number, string>> {
  const out: Record<number, string> = {};
  form.days.forEach((d, i) => {
    if (!d.open) return;
    const from = timeLabelToMinutes(d.from);
    const to = timeLabelToMinutes(d.to);
    if (from === null || to === null) out[i] = 'Pick an opening and a closing time.';
    else if (to <= from) out[i] = 'Closing time must be after opening time.';
  });
  return out;
}

/** The full week the API takes: exactly one entry per weekday 0..6 (`PUT /hours`). */
export function hoursFromForm(form: HoursForm): readonly HospitalHoursDay[] {
  return Array.from({ length: DAYS_IN_WEEK }, (_, weekday) => {
    const d = form.days[weekday];
    const isOpen = d?.open === true;
    return {
      weekday,
      isClosed: !isOpen,
      opensAt: isOpen && d ? labelToHhmm(d.from) : null,
      closesAt: isOpen && d ? labelToHhmm(d.to) : null,
    };
  });
}

/* ------------------------------------------------------------------- rules */

export function toRulesForm(r: HospitalRuleSettings): RulesForm {
  return {
    bookingWindowDays: String(r.bookingWindowDays),
    onlineRequiresApproval: r.onlineRequiresApproval,
    holdTimeoutMinutes: String(Math.round(r.holdTimeoutSeconds / SECONDS_PER_MINUTE)),
    cancellationCutoffHours: String(r.cancellationCutoffHours),
    refundBeforePct: bpToPercentInput(r.refundBeforeCutoffBp),
    refundAfterPct: bpToPercentInput(r.refundAfterCutoffBp),
    refundIncludesConvenienceFee: r.refundIncludesConvenienceFee,
    followUpWindowDays: String(r.followUpWindowDays),
    noShowCallAttempts: String(r.noShowCallAttempts),
    tokenCancelLimitMin: intText(r.tokenCancelLimitMin),
    expectedConsultMinutes: intText(r.expectedConsultMinutes),
    patientNotesEnabled: r.patientNotesEnabled,
    receiptPaper: r.receiptPaper,
    receiptShowStaff: r.receiptShowStaff,
    patientEditRequiresApproval: r.patientEditRequiresApproval,
    displayShowFullName: r.displayShowFullName,
    deskPaymentMethods: r.deskPaymentMethods,
  };
}

/** Rulebook field → problem; empty when the draft can be saved. */
export type RulesErrors = Partial<Record<keyof RulesForm, string>>;

export function rulesErrors(r: RulesForm): RulesErrors {
  const out: RulesErrors = {};
  const check = (key: keyof RulesForm, message: string | undefined): void => {
    if (message) out[key] = message;
  };
  check(
    'bookingWindowDays',
    boundedIntError(r.bookingWindowDays, 'Booking window', RULE_BOUNDS.bookingWindowDays),
  );
  check(
    'cancellationCutoffHours',
    boundedIntError(r.cancellationCutoffHours, 'Cut-off', RULE_BOUNDS.cancellationCutoffHours),
  );
  check(
    'followUpWindowDays',
    boundedIntError(r.followUpWindowDays, 'Follow-up window', RULE_BOUNDS.followUpWindowDays),
  );
  check(
    'expectedConsultMinutes',
    boundedIntError(
      r.expectedConsultMinutes,
      'Expected consultation time',
      RULE_BOUNDS.expectedConsultMinutes,
    ),
  );
  if (r.tokenCancelLimitMin.trim() !== '') {
    check(
      'tokenCancelLimitMin',
      boundedIntError(r.tokenCancelLimitMin, 'Token cancel limit', RULE_BOUNDS.tokenCancelLimitMin),
    );
  }
  if (percentInputToBp(r.refundBeforePct) === null) {
    out.refundBeforePct = 'Enter a refund between 0 and 100%.';
  }
  if (percentInputToBp(r.refundAfterPct) === null) {
    out.refundAfterPct = 'Enter a refund between 0 and 100%.';
  }
  if (r.deskPaymentMethods !== null && r.deskPaymentMethods.length === 0) {
    out.deskPaymentMethods = 'Accept at least one payment method at the desk.';
  }
  return out;
}

/** Only the rules that changed, in API units. Call after `rulesErrors` is empty. */
export function rulesChanges(base: RulesForm, draft: RulesForm): HospitalRuleChanges {
  const changed = new Set(dirtyRuleFields(base, draft));
  const int = (s: string): number => textInt(s) ?? 0;
  return {
    ...(changed.has('bookingWindowDays') && { bookingWindowDays: int(draft.bookingWindowDays) }),
    ...(changed.has('onlineRequiresApproval') && {
      onlineRequiresApproval: draft.onlineRequiresApproval,
    }),
    ...(changed.has('holdTimeoutMinutes') && {
      holdTimeoutSeconds: int(draft.holdTimeoutMinutes) * SECONDS_PER_MINUTE,
    }),
    ...(changed.has('cancellationCutoffHours') && {
      cancellationCutoffHours: int(draft.cancellationCutoffHours),
    }),
    ...(changed.has('refundBeforePct') && {
      refundBeforeCutoffBp: percentInputToBp(draft.refundBeforePct) ?? 0,
    }),
    ...(changed.has('refundAfterPct') && {
      refundAfterCutoffBp: percentInputToBp(draft.refundAfterPct) ?? 0,
    }),
    ...(changed.has('refundIncludesConvenienceFee') && {
      refundIncludesConvenienceFee: draft.refundIncludesConvenienceFee,
    }),
    ...(changed.has('followUpWindowDays') && { followUpWindowDays: int(draft.followUpWindowDays) }),
    ...(changed.has('noShowCallAttempts') && { noShowCallAttempts: int(draft.noShowCallAttempts) }),
    ...(changed.has('tokenCancelLimitMin') && {
      tokenCancelLimitMin: textInt(draft.tokenCancelLimitMin),
    }),
    ...(changed.has('expectedConsultMinutes') && {
      expectedConsultMinutes: int(draft.expectedConsultMinutes),
    }),
    ...(changed.has('patientNotesEnabled') && { patientNotesEnabled: draft.patientNotesEnabled }),
    ...(changed.has('receiptPaper') && { receiptPaper: draft.receiptPaper }),
    ...(changed.has('receiptShowStaff') && { receiptShowStaff: draft.receiptShowStaff }),
    ...(changed.has('patientEditRequiresApproval') && {
      patientEditRequiresApproval: draft.patientEditRequiresApproval,
    }),
    ...(changed.has('displayShowFullName') && { displayShowFullName: draft.displayShowFullName }),
    ...(changed.has('deskPaymentMethods') &&
      draft.deskPaymentMethods !== null && { deskPaymentMethods: draft.deskPaymentMethods }),
  };
}

/* ------------------------------------------------------------ token policy */

const MAX_MARKER_LENGTH = 8;
const MAX_PREFIX_LENGTH = 10;

export function toTokenForm(p: TokenPolicy): TokenForm {
  return {
    scope: p.pendingScope ?? p.scope,
    reset: p.pendingReset ?? p.reset,
    format: p.format,
    prefix: p.prefix,
    onlineMarker: p.onlineMarker,
    offlineMarker: p.offlineMarker,
    separateRanges: p.separateRanges,
    onlineRangeStart: intText(p.onlineRangeStart),
    onlineRangeEnd: intText(p.onlineRangeEnd),
    offlineRangeStart: intText(p.offlineRangeStart),
    offlineRangeEnd: intText(p.offlineRangeEnd),
    reuseCancelled: p.reuseCancelled,
    printTemplateId: p.printTemplateId ?? '',
  };
}

export type TokenErrors = Partial<Record<keyof TokenForm, string>>;

/** The backend's token-policy checks (`policy_settings._validate`), before sending. */
export function tokenErrors(t: TokenForm): TokenErrors {
  const out: TokenErrors = {};
  const format = formatError(t.format, TOKEN_LABEL_TOKENS);
  if (format) out.format = format;
  if (t.prefix.length > MAX_PREFIX_LENGTH)
    out.prefix = `Use at most ${MAX_PREFIX_LENGTH} characters.`;
  for (const key of ['onlineMarker', 'offlineMarker'] as const) {
    const value = t[key].trim();
    if (value === '') out[key] = 'Required.';
    else if (value.length > MAX_MARKER_LENGTH)
      out[key] = `Use at most ${MAX_MARKER_LENGTH} characters.`;
  }
  if (!t.separateRanges) return out;
  const ranges = [
    'onlineRangeStart',
    'onlineRangeEnd',
    'offlineRangeStart',
    'offlineRangeEnd',
  ] as const;
  for (const key of ranges) {
    const n = textInt(t[key]);
    if (n === null || n < 1) out[key] = 'Enter a number of 1 or more.';
  }
  if (ranges.some((k) => out[k])) return out;
  const [onS, onE, offS, offE] = ranges.map((k) => textInt(t[k]) ?? 0);
  if (onS === undefined || onE === undefined || offS === undefined || offE === undefined)
    return out;
  if (onS >= onE) out.onlineRangeEnd = 'Must be greater than the start.';
  if (offS >= offE) out.offlineRangeEnd = 'Must be greater than the start.';
  if (!out.onlineRangeEnd && !out.offlineRangeEnd && !(onE < offS || offE < onS)) {
    out.separateRanges = 'The online and desk ranges must not overlap.';
  }
  return out;
}

/**
 * Only the token-policy fields that changed. `scope`/`reset` are compared
 * with what will apply (the pending value when one is scheduled), so choosing
 * the value in force again sends it — which cancels the pending change (07·F4).
 */
export function tokenChanges(base: TokenForm, draft: TokenForm): TokenPolicyChanges {
  return {
    ...(draft.scope !== base.scope && { scope: draft.scope }),
    ...(draft.reset !== base.reset && { reset: draft.reset }),
    ...(draft.format !== base.format && { format: draft.format.trim() }),
    ...(draft.prefix !== base.prefix && { prefix: draft.prefix.trim() }),
    ...(draft.onlineMarker !== base.onlineMarker && { onlineMarker: draft.onlineMarker.trim() }),
    ...(draft.offlineMarker !== base.offlineMarker && {
      offlineMarker: draft.offlineMarker.trim(),
    }),
    ...(draft.separateRanges !== base.separateRanges && { separateRanges: draft.separateRanges }),
    ...(draft.onlineRangeStart !== base.onlineRangeStart && {
      onlineRangeStart: textInt(draft.onlineRangeStart),
    }),
    ...(draft.onlineRangeEnd !== base.onlineRangeEnd && {
      onlineRangeEnd: textInt(draft.onlineRangeEnd),
    }),
    ...(draft.offlineRangeStart !== base.offlineRangeStart && {
      offlineRangeStart: textInt(draft.offlineRangeStart),
    }),
    ...(draft.offlineRangeEnd !== base.offlineRangeEnd && {
      offlineRangeEnd: textInt(draft.offlineRangeEnd),
    }),
    ...(draft.reuseCancelled !== base.reuseCancelled && { reuseCancelled: draft.reuseCancelled }),
    ...(draft.printTemplateId !== base.printTemplateId && {
      printTemplateId: draft.printTemplateId === '' ? null : draft.printTemplateId,
    }),
  };
}

/* -------------------------------------------------------------------- bank */

/** The draft of one payout account (add or edit). */
export interface BankForm {
  readonly accountName: string;
  readonly bank: string;
  /** A NEW account number; empty keeps the stored one (it is never returned). */
  readonly account: string;
  readonly ifsc: string;
  readonly upi: string;
}

export function toBankForm(account: BankAccount | null): BankForm {
  return {
    accountName: account?.accountHolder ?? '',
    bank: account?.bankName ?? '',
    account: '',
    ifsc: account?.ifsc ?? '',
    upi: account?.upiId ?? '',
  };
}

/** The account payouts go to: the primary one, else the first. */
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
