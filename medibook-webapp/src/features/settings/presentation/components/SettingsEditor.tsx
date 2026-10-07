import { type ChangeEvent, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { type HospitalStaticView, hospitalPath, isHospitalRole } from '@/app/router/paths';

import { acceptFor } from '@/core/api/files.rules';
import type { Failure } from '@/core/error/failure';
import { isFailure } from '@/core/error/failure';

import { usePermission } from '@/shared/hooks/usePermission';
import { useUnsavedChanges } from '@/shared/hooks/useUnsavedChanges';
import { cn } from '@/shared/lib/cn';
import { addDaysISO, fmtDate, todayISO } from '@/shared/lib/format';
import {
  email as validateEmail,
  pincode as validatePincode,
  required,
} from '@/shared/lib/validate';
import { Card } from '@/shared/ui/Card';
import { ConfirmModal } from '@/shared/ui/ConfirmModal';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Field } from '@/shared/ui/Field';
import { Icon } from '@/shared/ui/Icon';
import type { IconName } from '@/shared/ui/icon-registry';
import { ImageUpload } from '@/shared/ui/ImageUpload';
import { InfoDot } from '@/shared/ui/InfoDot';
import { Select } from '@/shared/ui/Select';
import { SkeletonLine } from '@/shared/ui/Skeleton';
import { TextInput } from '@/shared/ui/TextInput';
import { toast } from '@/shared/ui/toast/toast.store';
import { Toggle } from '@/shared/ui/Toggle';
import { UnsavedBar } from '@/shared/ui/UnsavedBar';

import type {
  BankAccount,
  HospitalHoursDay,
  HospitalImagePurpose,
  HospitalProfile,
  HospitalRuleSettings,
  NumberingKind,
  NumberingSeries,
  TokenPolicy,
} from '@/features/settings/domain/entities/settings.entities';
import { useHospitalImageUrlQuery } from '@/features/settings/application/queries/useHospitalImageUrlQuery';
import { useReplaceHospitalHoursMutation } from '@/features/settings/application/queries/useReplaceHospitalHoursMutation';
import { useSaveBankAccountMutation } from '@/features/settings/application/queries/useSaveBankAccountMutation';
import { useUpdateHospitalProfileMutation } from '@/features/settings/application/queries/useUpdateHospitalProfileMutation';
import { useUpdateHospitalRuleSettingsMutation } from '@/features/settings/application/queries/useUpdateHospitalRuleSettingsMutation';
import { useUpdateNumberingMutation } from '@/features/settings/application/queries/useUpdateNumberingMutation';
import { useUpdateTokenPolicyMutation } from '@/features/settings/application/queries/useUpdateTokenPolicyMutation';
import { useUploadHospitalImageMutation } from '@/features/settings/application/queries/useUploadHospitalImageMutation';
import {
  type BankForm,
  CONSULT_MINUTES_MAX,
  FEE_VALIDITY_MAX_DAYS,
  HOLD_TIMEOUT_SERVER_OPTIONS,
  type HoursForm,
  NO_SHOW_CALL_OPTIONS,
  NUMBERING_KINDS,
  type NumberingForm,
  type ProfileForm,
  REFUND_OPTIONS,
  type RulesForm,
  SETTINGS_FORM_SECTIONS,
  type SettingsForm,
  type SettingsFormSection,
  TOKEN_CANCEL_OPTIONS,
  TOKEN_RESET_OPTIONS,
  TOKEN_SCOPE_OPTIONS,
  type TokenForm,
  bankInput,
  hasMixedHours,
  hoursFromForm,
  isSectionDirty,
  numberingChanges,
  profileChanges,
  rulesChanges,
  toBankForm,
  toHoursForm,
  toNumberingForm,
  toProfileForm,
  toRulesForm,
  toTokenForm,
  tokenChanges,
  tokenResetLabel,
  tokenCancelMinutes,
  tokenScopeLabel,
  withCurrent,
  withoutSections,
} from '@/features/settings/application/store/settings.form';
import {
  CANCEL_BEFORE_OPTIONS,
  CLOSE_TIME_OPTIONS,
  OPEN_TIME_OPTIONS,
  SCHEDULING_HORIZON_OPTIONS,
  calendarDay,
  cancellationDeadline,
  durationCopy,
  openDaysInHorizon,
  parseCount,
  parseDurationMinutes,
  renderTokenLabel,
  seriesFormatProblem,
  tokenFormatProblem,
} from '@/features/settings/application/store/settings.rules';

import { type NumberingErrorField, NumberingSettings } from './NumberingSettings';
import { RuleCard } from './RuleCard';
import { RuleRow } from './RuleRow';
import { SettingsHead } from './SettingsHead';

type SettingsSection =
  'General' | 'Management' | 'System Rules' | 'Numbering' | 'Working Hours' | 'Notifications';

const SETTINGS_NAV: readonly { readonly id: SettingsSection; readonly icon: IconName }[] = [
  { id: 'General', icon: 'building-2' },
  { id: 'Management', icon: 'layout-grid' },
  { id: 'System Rules', icon: 'sliders-horizontal' },
  { id: 'Numbering', icon: 'hash' },
  { id: 'Working Hours', icon: 'clock' },
  { id: 'Notifications', icon: 'bell' },
];

const MANAGE_LINKS: readonly [string, string, HospitalStaticView, IconName][] = [
  ['Hospital Profile', 'Branches, holiday calendar and patient-app banners', 'profile', 'building'],
  ['Services & Pricing', 'Service catalogue, taxes and coupons', 'services', 'indian-rupee'],
  ['Manage Doctors', 'Add doctors, schedules, availability', 'doctors', 'stethoscope'],
  ['Manage Departments', 'Create departments and assign doctors', 'doctors', 'layout-grid'],
  ['Slots & Availability', 'Shift patterns, exceptions and generated slots', 'slots', 'calendar-clock'], // prettier-ignore
  ['Messaging', 'Message templates, reminders and announcements', 'messaging', 'megaphone'],
  ['Audit Trail', 'Who changed what, when and from where', 'audit', 'scroll-text'],
  ['User Management', 'Manage admin, receptionist, accountant access', 'users', 'users'],
  ['Role Management', 'Configure roles and module permissions', 'users', 'shield-check'],
  ['Subscription & Plan', 'Manage subscription plan and payments', 'settlements', 'credit-card'],
];

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/**
 * What Medibook sends, from the backend's message rules (PRD-05). There is no
 * per-hospital switch for any of them yet, so each says what happens.
 */
const PATIENT_MESSAGES: readonly (readonly [string, string])[] = [
  ['Booking confirmed or approved', 'When a booking is confirmed, or approved by the desk'],
  ['Visit reminder', 'Before the appointment'],
  ['Cancellations and no-shows', 'When a booking is cancelled, rejected or marked a no-show'],
  ['Payments and refunds', 'When a payment is received or a refund is processed'],
];

const STAFF_EMAILS: readonly (readonly [string, string, string])[] = [
  ['Subscription invoices', 'Each invoice and its reminders, to admins', 'Always sent'],
  ['Plan usage', 'At 80% and 100% of the plan’s limits, to admins', 'Always sent'],
  ['Settlement statements', 'Each statement, to admins and accountants', 'Always sent'],
  ['Late settlement alerts', 'When an expected settlement is overdue', 'Coming later'],
];

/** The illustrative appointment the cancellation example is written against. */
const EXAMPLE_APPOINTMENT_TIME = '2:00 pm';

const PLATFORM_MANAGED_HINT = 'Managed by Medibook — contact support to change it.';

/** Fallback artwork while the hospital has no logo of its own. */
/** Landline or mobile: 10 or 11 digits once separators are stripped. */
const MIN_PHONE_DIGITS = 10;
const MAX_PHONE_DIGITS = 11;

const MAX_LATITUDE = 90;
const MAX_LONGITUDE = 180;

/** "9.9312, 76.2673" — the pair a map app copies; pasted into Latitude, it fills both. */
const COORD_PAIR = /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/;

/** Street-level zoom for the "check on a map" link. */
const MAP_LINK_ZOOM = 17;

const ACCOUNT_NUMBER_PATTERN = /^\d{9,18}$/;
const IFSC_PATTERN = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const UPI_PATTERN = /^[\w.-]{2,256}@[A-Za-z]{2,64}$/;

/** Every field that can carry an inline error on this screen. */
type SettingsErrorKey =
  | 'name'
  | 'phone'
  | 'email'
  | 'address'
  | 'city'
  | 'state'
  | 'pincode'
  | 'lat'
  | 'lng'
  | 'feeValidity'
  | 'consultMinutes'
  | 'tokenFormat'
  | 'tokenPrefix'
  | 'onlineMarker'
  | 'offlineMarker'
  | 'tokenRanges'
  | `${NumberingKind}${'Format' | 'Prefix' | 'PadWidth'}`
  | 'bankHolder'
  | 'bankName'
  | 'bankAccount'
  | 'bankIfsc'
  | 'bankUpi';

type SettingsErrors = Partial<Record<SettingsErrorKey, string>>;

/** Backend field name → the inline error slot it belongs to (profile, rules and bank). */
const SERVER_FIELD_KEY: Readonly<Record<string, SettingsErrorKey>> = {
  name: 'name',
  email: 'email',
  phone_e164: 'phone',
  address_line1: 'address',
  city: 'city',
  state: 'state',
  pincode: 'pincode',
  lat: 'lat',
  lng: 'lng',
  follow_up_window_days: 'feeValidity',
  expected_consult_minutes: 'consultMinutes',
  account_holder: 'bankHolder',
  bank_name: 'bankName',
  account_number: 'bankAccount',
  ifsc: 'bankIfsc',
  upi_id: 'bankUpi',
};

/** Token policy fields — `format` and `prefix` also exist on the number series. */
const TOKEN_FIELD_KEY: Readonly<Record<string, SettingsErrorKey>> = {
  format: 'tokenFormat',
  prefix: 'tokenPrefix',
  online_marker: 'onlineMarker',
  offline_marker: 'offlineMarker',
  separate_ranges: 'tokenRanges',
  online_range_start: 'tokenRanges',
  online_range_end: 'tokenRanges',
  offline_range_start: 'tokenRanges',
  offline_range_end: 'tokenRanges',
};

function numberingErrorKey(kind: NumberingKind, field: NumberingErrorField): SettingsErrorKey {
  return field === 'format'
    ? `${kind}Format`
    : field === 'prefix'
      ? `${kind}Prefix`
      : `${kind}PadWidth`;
}

/** Number series fields, by backend name. */
const NUMBERING_FIELD: Readonly<Record<string, NumberingErrorField>> = {
  format: 'format',
  prefix: 'prefix',
  pad_width: 'padWidth',
};

/** What each section is called in a "not saved" message. */
const SECTION_LABEL: Readonly<Record<SettingsFormSection, string>> = {
  profile: 'Profile & location',
  hours: 'Working hours',
  rules: 'System rules',
  token: 'Token settings',
  bank: 'Bank details',
  mrn: 'MRN numbering',
  booking: 'Booking numbering',
  receipt: 'Receipt numbering',
};

const TOKEN_FORMAT_MAX = 64;
const TOKEN_PREFIX_MAX = 10;
const TOKEN_MARKER_MAX = 8;
const SERIES_FORMAT_MAX = 64;
const SERIES_PREFIX_MAX = 20;
const SERIES_DIGITS_MAX = 12;

/** The token in the label preview. */
const PREVIEW_TOKEN_NO = 7;

function validateCoord(value: string, max: number, label: string): string | undefined {
  if (value.trim() === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) && Math.abs(n) <= max
    ? undefined
    : `${label} must be a number between -${max} and ${max}.`;
}

function validateProfile(p: ProfileForm, errors: SettingsErrors): void {
  const name = required(p.name, 'Hospital name');
  if (name) errors.name = name;
  const digits = p.phone.replace(/\D/g, '');
  if (digits.length < MIN_PHONE_DIGITS || digits.length > MAX_PHONE_DIGITS) {
    errors.phone = `Enter a ${MIN_PHONE_DIGITS}- or ${MAX_PHONE_DIGITS}-digit landline or mobile number.`;
  }
  const mail = validateEmail(p.email);
  if (mail) errors.email = mail;
  const address = required(p.address, 'Address');
  if (address) errors.address = address;
  const city = required(p.city, 'City');
  if (city) errors.city = city;
  const state = required(p.state, 'State');
  if (state) errors.state = state;
  const pin = validatePincode(p.pincode);
  if (pin) errors.pincode = pin;
  const lat = validateCoord(p.lat, MAX_LATITUDE, 'Latitude');
  if (lat) errors.lat = lat;
  const lng = validateCoord(p.lng, MAX_LONGITUDE, 'Longitude');
  if (lng) errors.lng = lng;
}

function validateRules(r: RulesForm, errors: SettingsErrors): void {
  const days = r.feeValidity.trim();
  if (days === '' || !/^\d+$/.test(days) || Number(days) > FEE_VALIDITY_MAX_DAYS) {
    errors.feeValidity = `The follow-up window must be 0–${FEE_VALIDITY_MAX_DAYS} days.`;
  }
  const minutes = Number(r.consultMinutes);
  if (!/^\d+$/.test(r.consultMinutes) || minutes < 1 || minutes > CONSULT_MINUTES_MAX) {
    errors.consultMinutes = `Enter 1–${CONSULT_MINUTES_MAX} minutes.`;
  }
}

function validateToken(t: TokenForm, errors: SettingsErrors): void {
  const format = t.format.trim();
  const problem =
    format === ''
      ? 'Enter a format, e.g. {SRC}{SEQ:3}.'
      : format.length > TOKEN_FORMAT_MAX
        ? `Keep the format to ${TOKEN_FORMAT_MAX} characters.`
        : tokenFormatProblem(format);
  if (problem) errors.tokenFormat = problem;
  if (t.prefix.trim().length > TOKEN_PREFIX_MAX) {
    errors.tokenPrefix = `Keep the prefix to ${TOKEN_PREFIX_MAX} characters.`;
  }
  const marker = (value: string): string | undefined => {
    const v = value.trim();
    return v === '' || v.length > TOKEN_MARKER_MAX
      ? `Enter 1–${TOKEN_MARKER_MAX} characters.`
      : undefined;
  };
  const online = marker(t.onlineMarker);
  if (online) errors.onlineMarker = online;
  const offline = marker(t.offlineMarker);
  if (offline) errors.offlineMarker = offline;
  if (!t.separateRanges) return;
  const [onlineFrom, onlineTo, walkInFrom, walkInTo] = [
    t.onlineFrom,
    t.onlineTo,
    t.walkInFrom,
    t.walkInTo,
  ].map((v) => (/^\d+$/.test(v.trim()) ? Number(v) : 0));
  if (!onlineFrom || !onlineTo || !walkInFrom || !walkInTo) {
    errors.tokenRanges = 'Enter all four numbers, each 1 or more.';
  } else if (onlineFrom >= onlineTo || walkInFrom >= walkInTo) {
    errors.tokenRanges = 'Each range must start below where it ends.';
  } else if (onlineFrom <= walkInTo && walkInFrom <= onlineTo) {
    errors.tokenRanges = 'The online and walk-in ranges must not overlap.';
  }
}

function validateNumbering(
  kind: NumberingKind,
  n: NumberingForm,
  base: NumberingForm,
  errors: SettingsErrors,
): void {
  const format = n.format.trim();
  const problem =
    format === ''
      ? 'Enter a format.'
      : format.length > SERIES_FORMAT_MAX
        ? `Keep the format to ${SERIES_FORMAT_MAX} characters.`
        : seriesFormatProblem(format);
  if (problem) errors[`${kind}Format`] = problem;
  if (n.prefix.trim().length > SERIES_PREFIX_MAX) {
    errors[`${kind}Prefix`] = `Keep the prefix to ${SERIES_PREFIX_MAX} characters.`;
  }
  const digits = Number(n.padWidth);
  if (!/^\d+$/.test(n.padWidth) || digits < 1 || digits > SERIES_DIGITS_MAX) {
    errors[`${kind}PadWidth`] = `Enter 1–${SERIES_DIGITS_MAX} digits.`;
  }
  // The server's own rule for booking references (backend `numbering._booking_prefix`).
  if (kind === 'booking' && (n.format !== base.format || n.prefix !== base.prefix)) {
    if (!problem && !format.includes('{PREFIX}')) {
      errors.bookingFormat = 'Booking references must include {PREFIX}.';
    }
    if (n.prefix.trim() === '') {
      errors.bookingPrefix = 'Enter a prefix — it marks your hospital’s booking references.';
    }
  }
}

function validateBank(b: BankForm, hasAccount: boolean, errors: SettingsErrors): void {
  const holder = required(b.accountName, 'Account holder name');
  if (holder) errors.bankHolder = holder;
  const bank = required(b.bank, 'Bank');
  if (bank) errors.bankName = bank;
  const number = b.account.replace(/\s/g, '');
  if (number === '' && !hasAccount) {
    errors.bankAccount = 'Account number is required.';
  } else if (number !== '' && !ACCOUNT_NUMBER_PATTERN.test(number)) {
    errors.bankAccount = 'Account number must be 9–18 digits.';
  }
  if (!IFSC_PATTERN.test(b.ifsc.trim().toUpperCase())) {
    errors.bankIfsc = 'IFSC looks like ABCD0123456 — 4 letters, a zero, then 6 characters.';
  }
  if (b.upi.trim() !== '' && !UPI_PATTERN.test(b.upi.trim())) {
    errors.bankUpi = 'UPI ID looks like name@bank.';
  }
}

/** Which inline slot a backend field's error belongs to, for the section that sent it. */
function errorKeyFor(section: SettingsFormSection, field: string): SettingsErrorKey | undefined {
  if (section === 'token') return TOKEN_FIELD_KEY[field];
  if (section === 'mrn' || section === 'booking' || section === 'receipt') {
    const slot = NUMBERING_FIELD[field];
    return slot ? numberingErrorKey(section, slot) : undefined;
  }
  return SERVER_FIELD_KEY[field];
}

/** Server field errors, mapped onto this screen's inline slots. */
function serverFieldErrors(failure: Failure, section: SettingsFormSection): SettingsErrors {
  const out: SettingsErrors = {};
  for (const [field, messages] of Object.entries(failure.fieldErrors)) {
    const key = errorKeyFor(section, field);
    const first = messages[0];
    if (key && first) out[key] = first;
  }
  return out;
}

/** Today's value and a change waiting to apply, or when a change would take effect. */
function schedulingCopy<T extends string>(
  today: T,
  pending: T | null,
  effectiveDate: string | null,
  label: (value: T) => string,
): string {
  return pending && pending !== today && effectiveDate
    ? `Today: ${label(today)}. From ${fmtDate(effectiveDate)}: ${label(pending)}.`
    : 'A change takes effect tomorrow.';
}

/**
 * An OpenStreetMap link centred on the coordinates, to check them before
 * saving (PRD-01); `null` until both are valid numbers.
 */
function mapLinkFor(lat: string, lng: string): string | null {
  if (lat.trim() === '' || lng.trim() === '') return null;
  if (validateCoord(lat, MAX_LATITUDE, '') || validateCoord(lng, MAX_LONGITUDE, '')) return null;
  const la = Number(lat);
  const ln = Number(lng);
  return `https://www.openstreetmap.org/?mlat=${la}&mlon=${ln}#map=${MAP_LINK_ZOOM}/${la}/${ln}`;
}

/** The bank section's data, which loads (and may be refused) separately. */
export type BankAccountsState =
  | { readonly status: 'hidden' }
  | { readonly status: 'loading' }
  | { readonly status: 'error'; readonly error: unknown; readonly retry: () => void }
  | { readonly status: 'ready'; readonly account: BankAccount | null };

interface SettingsEditorProps {
  profile: HospitalProfile;
  rules: HospitalRuleSettings;
  hours: readonly HospitalHoursDay[];
  tokenPolicy: TokenPolicy;
  numbering: readonly NumberingSeries[];
  bank: BankAccountsState;
}

/**
 * The Hospital Settings editor (module H2) — one draft per backend resource
 * (profile, hours, rules, token policy, payout account), a sticky
 * `UnsavedBar`, `useUnsavedChanges` blocking route navigation, and the
 * synchronous `confirmDiscard()` on the section tabs React Router never sees.
 *
 * Save sends only the sections that changed, in parallel; a section that
 * fails keeps its edits and says why, while the ones that saved are done.
 * Every setting the backend stores and uses is editable here (PRD-06); rules
 * the backend has no field for are stated as facts, not shown as dead
 * controls (PRD-05).
 */
export function SettingsEditor({
  profile,
  rules,
  hours,
  tokenPolicy,
  numbering,
  bank,
}: SettingsEditorProps) {
  const navigate = useNavigate();
  const { role: roleParam } = useParams();
  const role = isHospitalRole(roleParam) ? roleParam : 'admin';

  const { can } = usePermission();
  const mayEdit = can('Hospital Settings.edit');
  const canEditBank = bank.status === 'ready' && can('Billing & Settlements.edit');

  const updateProfile = useUpdateHospitalProfileMutation();
  const updateRules = useUpdateHospitalRuleSettingsMutation();
  const replaceHours = useReplaceHospitalHoursMutation();
  const updateTokenPolicy = useUpdateTokenPolicyMutation();
  const updateNumbering = useUpdateNumberingMutation();
  const saveBank = useSaveBankAccountMutation();
  const uploadImage = useUploadHospitalImageMutation();

  const bankAccount = bank.status === 'ready' ? bank.account : null;
  const base: SettingsForm = {
    profile: toProfileForm(profile),
    hours: toHoursForm(hours),
    rules: toRulesForm(rules),
    token: toTokenForm(tokenPolicy),
    bank: toBankForm(bankAccount),
    mrn: toNumberingForm(numbering.find((x) => x.kind === 'mrn')),
    booking: toNumberingForm(numbering.find((x) => x.kind === 'booking')),
    receipt: toNumberingForm(numbering.find((x) => x.kind === 'receipt')),
  };

  const [sec, setSec] = useState<SettingsSection>('General');
  const [edits, setEdits] = useState<Partial<SettingsForm>>({});
  const [previews, setPreviews] = useState<Readonly<Record<string, string>>>({});
  const [serverErrors, setServerErrors] = useState<SettingsErrors>({});
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);

  const draft: SettingsForm = { ...base, ...edits };
  const dirtySections = SETTINGS_FORM_SECTIONS.filter((s) => isSectionDirty(base, draft, s));
  const dirty = dirtySections.length > 0;

  const errors: SettingsErrors = {};
  if (dirtySections.includes('profile')) validateProfile(draft.profile, errors);
  if (dirtySections.includes('rules')) validateRules(draft.rules, errors);
  if (dirtySections.includes('token')) validateToken(draft.token, errors);
  for (const kind of NUMBERING_KINDS) {
    if (dirtySections.includes(kind)) validateNumbering(kind, draft[kind], base[kind], errors);
  }
  if (dirtySections.includes('bank')) validateBank(draft.bank, bankAccount !== null, errors);
  const errorCount = Object.keys(errors).length;
  const errorFor = (key: SettingsErrorKey): string | undefined =>
    (attempted ? errors[key] : undefined) ?? serverErrors[key];

  const { blocked, discard, keepEditing, confirmDiscard } = useUnsavedChanges({
    dirty,
    message:
      'You have unsaved hospital settings. Discard them?\n\nHours, cut-offs and profile details will stay as they were.',
  });

  const setProfile = <K extends keyof ProfileForm>(k: K, v: ProfileForm[K]) =>
    setEdits((e) => ({ ...e, profile: { ...(e.profile ?? base.profile), [k]: v } }));
  const setHours = <K extends keyof HoursForm>(k: K, v: HoursForm[K]) =>
    setEdits((e) => ({ ...e, hours: { ...(e.hours ?? base.hours), [k]: v } }));
  const setRule = <K extends keyof RulesForm>(k: K, v: RulesForm[K]) =>
    setEdits((e) => ({ ...e, rules: { ...(e.rules ?? base.rules), [k]: v } }));
  const setToken = <K extends keyof TokenForm>(k: K, v: TokenForm[K]) =>
    setEdits((e) => ({ ...e, token: { ...(e.token ?? base.token), [k]: v } }));
  const setNumbering = (kind: NumberingKind, k: keyof NumberingForm, v: string) =>
    setEdits((e) => ({ ...e, [kind]: { ...(e[kind] ?? base[kind]), [k]: v } }));
  const setBank = (k: keyof BankForm, v: string) =>
    setEdits((e) => ({ ...e, bank: { ...(e.bank ?? base.bank), [k]: v } }));

  const resetDraft = (): void => {
    setEdits({});
    setServerErrors({});
    setAttempted(false);
  };

  /** Section tabs are in-page: React Router never sees them (audit 3.7.1). */
  const switchSection = (next: SettingsSection): void => {
    if (next === sec) return;
    if (!confirmDiscard()) return;
    resetDraft();
    setSec(next);
  };

  const onNavigate = (view: HospitalStaticView): void => {
    navigate(hospitalPath(role, view));
  };

  /** One save job per dirty section; each resolves or rejects with a `Failure`. */
  const saveJob = (section: SettingsFormSection): Promise<unknown> => {
    switch (section) {
      case 'profile':
        return updateProfile.mutateAsync({
          changes: profileChanges(base.profile, draft.profile),
          version: profile.version,
        });
      case 'rules':
        return updateRules.mutateAsync({
          changes: rulesChanges(base.rules, draft.rules),
          version: rules.version,
        });
      case 'hours':
        return replaceHours.mutateAsync(hoursFromForm(draft.hours));
      case 'token':
        return updateTokenPolicy.mutateAsync({
          changes: tokenChanges(base.token, draft.token),
          version: tokenPolicy.version,
        });
      case 'bank':
        return saveBank.mutateAsync({ input: bankInput(draft.bank), existing: bankAccount });
      case 'mrn':
      case 'booking':
      case 'receipt': {
        const series = numbering.find((x) => x.kind === section);
        // A series the server did not list is never shown, so it never has edits.
        if (!series) return Promise.resolve();
        return updateNumbering.mutateAsync({
          kind: section,
          changes: numberingChanges(base[section], draft[section]),
          version: series.version,
        });
      }
    }
  };

  const save = async (): Promise<void> => {
    setAttempted(true);
    setServerErrors({});
    if (errorCount > 0) return;
    const sections = dirtySections.filter((s) => s !== 'bank' || canEditBank);
    if (sections.length === 0) return;
    const tokenScheduled =
      sections.includes('token') &&
      (draft.token.scope !== base.token.scope || draft.token.reset !== base.token.reset);
    setSaving(true);
    const results = await Promise.allSettled(sections.map(saveJob));
    setSaving(false);

    const saved: SettingsFormSection[] = [];
    let fieldErrors: SettingsErrors = {};
    results.forEach((result, i) => {
      const section = sections[i];
      if (section === undefined) return;
      if (result.status === 'fulfilled') {
        saved.push(section);
        return;
      }
      const reason: unknown = result.reason;
      const message = isFailure(reason) ? reason.message : 'Something went wrong.';
      if (isFailure(reason)) {
        fieldErrors = { ...fieldErrors, ...serverFieldErrors(reason, section) };
      }
      toast(`${SECTION_LABEL[section]} not saved — ${message}`, 'error', reason);
    });

    setEdits((e) => withoutSections(e, saved));
    setServerErrors(fieldErrors);
    if (saved.length === sections.length) {
      setAttempted(false);
      toast(
        tokenScheduled
          ? 'Settings saved — the token counter change takes effect tomorrow'
          : 'Settings saved',
        'success',
      );
    }
  };

  /** Upload a picked image now; the profile points at it once Save is pressed. */
  const pickImage =
    (purpose: HospitalImagePurpose, onUploaded: (fileId: string) => void) =>
    (e: ChangeEvent<HTMLInputElement>) => {
      const input = e.currentTarget;
      const file = input.files?.[0];
      input.value = '';
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const preview = typeof reader.result === 'string' ? reader.result : null;
        uploadImage.mutate(
          { file, purpose },
          {
            onSuccess: (fileId) => {
              if (preview) setPreviews((p) => ({ ...p, [fileId]: preview }));
              onUploaded(fileId);
            },
            onError: (error) => {
              toast(
                isFailure(error) ? error.message : 'The image could not be uploaded.',
                'error',
                error,
              );
            },
          },
        );
      };
      reader.readAsDataURL(file);
    };

  const logoId = draft.profile.logoFileId;
  const coverId = draft.profile.coverFileId;
  const logoUrl = useHospitalImageUrlQuery(logoId && !previews[logoId] ? logoId : null);
  const coverUrl = useHospitalImageUrlQuery(coverId && !previews[coverId] ? coverId : null);
  const logoSrc = logoId ? (previews[logoId] ?? logoUrl.data ?? null) : null;
  const coverSrc = coverId ? (previews[coverId] ?? coverUrl.data ?? null) : null;

  const sel = (
    value: string,
    options: readonly string[],
    onChange: (v: string) => void,
    ariaLabel: string,
  ) => (
    <div className="w-32.5">
      <Select
        value={value}
        options={withCurrent(options, value)}
        onChange={onChange}
        height={40}
        aria-label={ariaLabel}
        disabled={!mayEdit}
      />
    </div>
  );

  /* ---- derived consequences of the draft's own rules (audit 2.6.4) ---- */

  const estimate = rules.derived.slotsPerSessionEstimate;
  const slotsCopy = estimate
    ? `≈ ${estimate.avg} slots per doctor session`
    : 'slot counts appear once doctors have weekly sessions';
  const horizonDays = parseCount(draft.rules.horizon, 30);
  const horizonStart = todayISO();
  const horizonEnd = addDaysISO(horizonStart, horizonDays - 1);
  const horizonOpenDays = openDaysInHorizon(horizonStart, horizonDays, draft.hours.days);
  const cancelHours = parseDurationMinutes(draft.rules.cancelBefore, 120) / 60;
  const cancelDeadline = cancellationDeadline(EXAMPLE_APPOINTMENT_TIME, cancelHours);
  const holdMinutes = parseDurationMinutes(draft.rules.holdTimeout, 5);
  const openDays = draft.hours.days.filter(Boolean).length;
  const feeDays = parseCount(draft.rules.feeValidity, 0);
  const mapLink = mapLinkFor(draft.profile.lat, draft.profile.lng);
  const hoursUnset = hours.length === 0;
  const hoursMixed = hasMixedHours(hours);
  const tokenCancelMin = tokenCancelMinutes(draft.rules.tokenCancel);
  const tokenCancelCopy =
    tokenCancelMin === null
      ? 'Patients can cancel in the app until their token is called'
      : tokenCancelMin === 0
        ? 'Patients can cancel in the app until the session starts'
        : `Patients can cancel in the app until ${durationCopy(tokenCancelMin)} before the session`;
  const tokenFormat = draft.token.format.trim();
  const previewLabel = (marker: string): string =>
    renderTokenLabel(tokenFormat, {
      prefix: draft.token.prefix.trim(),
      marker: marker.trim(),
      seq: PREVIEW_TOKEN_NO,
      doctorCode: '‹doctor›',
      departmentCode: '‹department›',
      date: calendarDay(todayISO()),
    });
  const tokenPreviewCopy = tokenFormatProblem(tokenFormat)
    ? 'Must contain {SEQ} or {SEQ:3} once'
    : `Token ${PREVIEW_TOKEN_NO} shows as ${previewLabel(draft.token.onlineMarker)} for an online booking and ${previewLabel(draft.token.offlineMarker)} for a walk-in`;

  return (
    <div className="flex items-start gap-5">
      <Card pad={10} className="w-60 flex-none">
        {SETTINGS_NAV.map((s) => {
          const active = sec === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => switchSection(s.id)}
              className={cn(
                'text-body flex w-full cursor-pointer items-center gap-3 rounded-md border-none px-3.5 py-3 text-left transition-colors duration-150',
                active
                  ? 'bg-blue-soft-bg text-text-navy font-semibold'
                  : 'text-text-muted hover:bg-grey-200 bg-transparent font-medium',
              )}
            >
              <Icon name={s.icon} size={19} /> {s.id}
              {dirty && !active && (
                <>
                  <span className="bg-y-600 ml-auto size-2 rounded-full" />
                  <span className="sr-only">(unsaved edits)</span>
                </>
              )}
            </button>
          );
        })}
        {dirty && (
          <div className="text-caption text-text-muted border-border-soft mt-2 border-t px-3.5 pt-3">
            Unsaved edits are kept while you move between sections — switching asks first.
          </div>
        )}
      </Card>

      <div className="flex min-w-0 flex-1 flex-col gap-5">
        {!mayEdit && (
          <Card pad={14} className="flex items-center gap-2.5">
            <Icon name="lock" size={16} className="text-text-muted flex-none" />
            <span className="text-body text-text-muted">
              Read-only: your role can view hospital settings but not change them.
            </span>
          </Card>
        )}

        {attempted && errorCount > 0 && (
          <Card pad={14} className="flex items-center gap-2.5">
            <Icon name="triangle-alert" size={16} className="text-d-600 flex-none" />
            <span className="text-body text-d-700">
              {errorCount === 1
                ? 'One field needs attention before these settings can be saved.'
                : `${errorCount} fields need attention before these settings can be saved.`}{' '}
              The section showing a red message is where to fix it.
            </span>
          </Card>
        )}

        {sec === 'General' && (
          <>
            <Card pad={28}>
              <SettingsHead info="Your logo, name and details appear on the hospital's profile in the Medibook patient app.">
                Hospital Profile
              </SettingsHead>
              <div className="mb-6.5 flex items-center gap-4.5">
                <div className="bg-blue-soft-bg flex size-18 flex-none items-center justify-center overflow-hidden rounded-lg">
                  {logoSrc ? (
                    <img src={logoSrc} className="h-full w-full object-cover" alt="" />
                  ) : (
                    <Icon name="building-2" size={32} className="text-blue" />
                  )}
                </div>
                <div>
                  <label className="inline-block">
                    {/* Visually hidden but focusable: Tab reaches it, Space opens the picker. */}
                    <input
                      type="file"
                      accept={acceptFor('logo')}
                      className="peer sr-only"
                      disabled={!mayEdit || uploadImage.isPending}
                      onChange={pickImage('logo', (id) => setProfile('logoFileId', id))}
                    />
                    <span className="text-body border-text-navy text-text-navy peer-focus-visible:outline-blue inline-flex cursor-pointer items-center gap-2 rounded-lg border bg-white px-3.5 py-2 font-medium peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2">
                      <Icon name="upload" size={16} /> Change Logo
                    </span>
                  </label>
                  <div className="text-caption text-text-muted mt-2">
                    {uploadImage.isPending ? 'Uploading…' : 'PNG, JPG or WebP, up to 10MB'}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-x-8 gap-y-5.5">
                <Field label="Hospital Name" required error={errorFor('name')}>
                  <TextInput
                    value={draft.profile.name}
                    onChange={(v) => setProfile('name', v)}
                    disabled={!mayEdit}
                  />
                </Field>
                <Field label="Registration No." hint={PLATFORM_MANAGED_HINT}>
                  <TextInput value={profile.registrationNo ?? ''} disabled />
                </Field>
                <Field label="GSTIN" hint={`Printed on every receipt. ${PLATFORM_MANAGED_HINT}`}>
                  <TextInput value={profile.gstin ?? ''} disabled />
                </Field>
                <Field label="Phone" required error={errorFor('phone')}>
                  <TextInput
                    value={draft.profile.phone}
                    onChange={(v) => setProfile('phone', v)}
                    inputMode="tel"
                    autoComplete="tel"
                    disabled={!mayEdit}
                  />
                </Field>
                <Field label="Email" required error={errorFor('email')}>
                  <TextInput
                    value={draft.profile.email}
                    onChange={(v) => setProfile('email', v)}
                    inputMode="email"
                    autoComplete="email"
                    disabled={!mayEdit}
                  />
                </Field>
              </div>
            </Card>

            <Card pad={28}>
              <SettingsHead info="These photos show in your hospital's gallery when patients browse in the Medibook app.">
                Photo Gallery
              </SettingsHead>
              <div className="grid grid-cols-3 gap-4">
                <label className="block cursor-pointer">
                  <input
                    type="file"
                    accept={acceptFor('cover')}
                    aria-label="Cover photo"
                    className="peer sr-only"
                    disabled={!mayEdit || uploadImage.isPending}
                    onChange={pickImage('cover', (id) => setProfile('coverFileId', id))}
                  />
                  {coverSrc ? (
                    <img
                      src={coverSrc}
                      className="border-border h-32.5 w-full rounded-lg border object-cover"
                      alt=""
                    />
                  ) : (
                    <span className="pointer-events-none block">
                      <ImageUpload label="Cover photo" hint="1280×720" h={130} />
                    </span>
                  )}
                </label>
              </div>
              <div className="text-caption text-text-muted mt-4">
                The cover photo is the one patients see. More gallery photos are coming later.
              </div>
            </Card>

            <Card pad={28}>
              <SettingsHead info="Patients see your location and get directions in the Medibook app. Copy the coordinates from a map app and paste them here.">
                Location
              </SettingsHead>
              <div className="flex flex-col gap-4">
                <Field label="Address" required error={errorFor('address')}>
                  <TextInput
                    value={draft.profile.address}
                    onChange={(v) => setProfile('address', v)}
                    disabled={!mayEdit}
                  />
                </Field>
                <div className="grid grid-cols-3 gap-4">
                  <Field label="City" required error={errorFor('city')}>
                    <TextInput
                      value={draft.profile.city}
                      onChange={(v) => setProfile('city', v)}
                      disabled={!mayEdit}
                    />
                  </Field>
                  <Field label="State" required error={errorFor('state')}>
                    <TextInput
                      value={draft.profile.state}
                      onChange={(v) => setProfile('state', v)}
                      disabled={!mayEdit}
                    />
                  </Field>
                  <Field label="PIN Code" required error={errorFor('pincode')}>
                    <TextInput
                      value={draft.profile.pincode}
                      onChange={(v) => setProfile('pincode', v)}
                      inputMode="numeric"
                      autoComplete="postal-code"
                      disabled={!mayEdit}
                    />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Latitude" error={errorFor('lat')}>
                    <TextInput
                      value={draft.profile.lat}
                      onChange={(v) => {
                        const pair = COORD_PAIR.exec(v);
                        if (pair?.[1] && pair[2]) {
                          const [, lat, lng] = pair;
                          setEdits((ed) => ({
                            ...ed,
                            profile: { ...(ed.profile ?? base.profile), lat, lng },
                          }));
                        } else {
                          setProfile('lat', v);
                        }
                      }}
                      inputMode="decimal"
                      placeholder="e.g. 9.9312"
                      disabled={!mayEdit}
                    />
                  </Field>
                  <Field label="Longitude" error={errorFor('lng')}>
                    <TextInput
                      value={draft.profile.lng}
                      onChange={(v) => setProfile('lng', v)}
                      inputMode="decimal"
                      placeholder="e.g. 76.2673"
                      disabled={!mayEdit}
                    />
                  </Field>
                </div>
                <div className="text-caption text-text-muted flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="flex items-center gap-1.5">
                    <Icon name="map-pin" size={14} /> In a map app, copy your entrance's coordinates
                    and paste them into Latitude — both fields fill in.
                  </span>
                  {mapLink && (
                    <a
                      href={mapLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-link font-medium underline-offset-2 hover:underline"
                    >
                      Check on OpenStreetMap
                      <span className="sr-only"> (opens in a new tab)</span>
                    </a>
                  )}
                </div>
              </div>
            </Card>

            <Card pad={28}>
              <SettingsHead info="Medibook releases online-booking settlements to this account. Medibook's operations team sees only its last four digits, on each payout.">
                Bank &amp; Payouts
              </SettingsHead>
              {bank.status === 'hidden' && (
                <div className="text-body text-text-muted flex items-center gap-2.5">
                  <Icon name="lock" size={16} className="flex-none" /> Bank details are limited to
                  roles with the Billing &amp; Settlements view permission.
                </div>
              )}
              {bank.status === 'loading' && (
                <div className="flex flex-col gap-4">
                  <SkeletonLine w="60%" />
                  <SkeletonLine w="80%" />
                  <SkeletonLine w="50%" />
                </div>
              )}
              {bank.status === 'error' && (
                <ErrorState
                  inline
                  title="Bank details did not load"
                  message="The rest of the settings are fine. Retry to load the payout account."
                  error={bank.error}
                  onRetry={bank.retry}
                />
              )}
              {bank.status === 'ready' && (
                <>
                  {bankAccount === null && (
                    <div className="text-caption text-text-muted mb-4">
                      No payout account yet — fill these in and save to add one.
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-x-8 gap-y-5.5">
                    <Field label="Account Holder Name" error={errorFor('bankHolder')}>
                      <TextInput
                        value={draft.bank.accountName}
                        onChange={(v) => setBank('accountName', v)}
                        disabled={!canEditBank}
                      />
                    </Field>
                    <Field label="Bank" error={errorFor('bankName')}>
                      <TextInput
                        value={draft.bank.bank}
                        onChange={(v) => setBank('bank', v)}
                        disabled={!canEditBank}
                      />
                    </Field>
                    <Field
                      label="Account Number"
                      error={errorFor('bankAccount')}
                      hint={
                        bankAccount
                          ? `Stored number ends in ${bankAccount.accountLast4}. Leave blank to keep it; a new number must be verified again.`
                          : undefined
                      }
                    >
                      <TextInput
                        value={draft.bank.account}
                        onChange={(v) => setBank('account', v)}
                        placeholder={bankAccount ? `•••• ${bankAccount.accountLast4}` : undefined}
                        inputMode="numeric"
                        disabled={!canEditBank}
                      />
                    </Field>
                    <Field label="IFSC Code" error={errorFor('bankIfsc')}>
                      <TextInput
                        value={draft.bank.ifsc}
                        onChange={(v) => setBank('ifsc', v.toUpperCase())}
                        disabled={!canEditBank}
                      />
                    </Field>
                    <Field label="Settlement UPI ID (optional)" error={errorFor('bankUpi')}>
                      <TextInput
                        value={draft.bank.upi}
                        onChange={(v) => setBank('upi', v)}
                        disabled={!canEditBank}
                      />
                    </Field>
                  </div>
                </>
              )}
              <div className="text-caption text-text-muted bg-y-100 mt-4.5 flex items-center gap-2 rounded-md px-3 py-2.5">
                <Icon name="lock" size={15} className="text-y-700 flex-none" /> Settlement payouts
                pause if these details are missing or invalid — keep them current.
              </div>
            </Card>
          </>
        )}

        {sec === 'Working Hours' && (
          <Card pad={28}>
            <SettingsHead info="Hospital-level hours. Department and doctor schedules override these — the app uses the most specific (Doctor → Department → Hospital).">
              Hospital Working Hours
            </SettingsHead>
            {(hoursUnset || hoursMixed) && (
              <div className="text-caption text-text-muted bg-y-100 mb-4 flex items-center gap-2 rounded-md px-3 py-2.5">
                <Icon name="info" size={15} className="text-y-700 flex-none" />
                {hoursUnset
                  ? 'Working hours have not been set yet — every day reads Closed until you save.'
                  : 'Some days currently have different hours. Saving applies the times below to every open day.'}
              </div>
            )}
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <span className="text-body text-text-muted">Default open</span>
              <div className="w-30">
                <Select
                  value={draft.hours.open}
                  options={withCurrent(OPEN_TIME_OPTIONS, draft.hours.open)}
                  onChange={(v) => setHours('open', v)}
                  height={40}
                  aria-label="Default opening time"
                  disabled={!mayEdit}
                />
              </div>
              <span className="text-body text-text-muted">to</span>
              <div className="w-30">
                <Select
                  value={draft.hours.close}
                  options={withCurrent(CLOSE_TIME_OPTIONS, draft.hours.close)}
                  onChange={(v) => setHours('close', v)}
                  height={40}
                  aria-label="Default closing time"
                  disabled={!mayEdit}
                />
              </div>
              <span className="text-caption text-text-muted">
                {openDays} open {openDays === 1 ? 'day' : 'days'} a week ·{' '}
                <span className="text-text-strong font-medium">{slotsCopy}</span>
              </span>
            </div>
            <div className="flex flex-col gap-3">
              {DAYS.map((d, i) => (
                <div
                  key={d}
                  className="border-border-soft flex items-center gap-4 rounded-md border px-4 py-3"
                >
                  <span className="text-body text-text-strong w-27.5 font-medium">{d}</span>
                  <Toggle
                    value={draft.hours.days[i] === true}
                    onChange={(v) =>
                      setHours(
                        'days',
                        draft.hours.days.map((x, j) => (j === i ? v : x)),
                      )
                    }
                    label={`${d} open`}
                    disabled={!mayEdit}
                  />
                  <span className="flex-1"></span>
                  <span
                    className={cn(
                      'text-body',
                      draft.hours.days[i] ? 'text-text-body' : 'text-text-muted',
                    )}
                  >
                    {draft.hours.days[i] ? `${draft.hours.open} — ${draft.hours.close}` : 'Closed'}
                  </span>
                </div>
              ))}
            </div>
            <div className="text-caption text-text-muted mt-4">
              One-off closures (holidays, maintenance, department leave) live on the holiday
              calendar in Hospital Profile — slot generation reads both.
            </div>
          </Card>
        )}

        {sec === 'Management' && (
          <Card pad={8}>
            {MANAGE_LINKS.map(([t, d, view, ic], i) => (
              <button
                key={t}
                type="button"
                onClick={() => onNavigate(view)}
                className={cn(
                  'hover:bg-grey-200 flex w-full cursor-pointer items-center gap-3.5 rounded-md border-none bg-transparent px-4.5 py-4 text-left transition-colors duration-150',
                  i < MANAGE_LINKS.length - 1 && 'border-border-soft border-b',
                )}
              >
                <div className="bg-blue-soft-bg text-blue flex size-10 flex-none items-center justify-center rounded-md">
                  <Icon name={ic} size={20} />
                </div>
                <div className="flex-1">
                  <div className="text-body text-text-strong font-medium">{t}</div>
                  <div className="text-caption text-text-muted">{d}</div>
                </div>
                <Icon name="chevron-right" size={20} className="text-text-muted" />
              </button>
            ))}
          </Card>
        )}

        {sec === 'System Rules' && (
          <>
            <div className="flex items-center gap-2">
              <span className="text-caption text-grey-900">
                Hospital-wide rules. Slot length, consultation and follow-up fees are set per
                doctor. Each rule shows what it does with its current value.
              </span>
              <InfoDot text="These apply to every department and doctor. A doctor's own slot length, fees and expected consultation time always take precedence." />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <RuleCard title="Booking" hint="Applies to new bookings">
                <RuleRow
                  label="Scheduling horizon"
                  hint={`Booking is open to ${fmtDate(horizonEnd)} — ${horizonOpenDays} open ${horizonOpenDays === 1 ? 'day' : 'days'}. Nothing past it is generated or offered.`}
                >
                  {sel(
                    draft.rules.horizon,
                    SCHEDULING_HORIZON_OPTIONS,
                    (v) => setRule('horizon', v),
                    'Scheduling horizon',
                  )}
                </RuleRow>
                <RuleRow
                  label="Online appointment booking"
                  hint={`Managed by Medibook — ${
                    profile.onlineBookingEnabled
                      ? 'patients can book from the Medibook app'
                      : 'app booking is off; walk-in and desk bookings only'
                  }`}
                >
                  <Toggle
                    value={profile.onlineBookingEnabled}
                    onChange={() => undefined}
                    label="Allow online appointment booking"
                    disabled
                  />
                </RuleRow>
                <RuleRow
                  label="Approve online bookings"
                  hint={
                    draft.rules.onlineApproval
                      ? 'Online bookings wait in Appointments until the desk approves or rejects them'
                      : 'Online bookings are confirmed without waiting for the desk'
                  }
                >
                  <Toggle
                    value={draft.rules.onlineApproval}
                    onChange={(v) => setRule('onlineApproval', v)}
                    label="Approve online bookings before they are confirmed"
                    disabled={!mayEdit}
                  />
                </RuleRow>
                <RuleRow
                  label="Hold timeout"
                  hint={`Unpaid online bookings are released after ${durationCopy(holdMinutes)}, freeing the slot`}
                >
                  {sel(
                    draft.rules.holdTimeout,
                    HOLD_TIMEOUT_SERVER_OPTIONS,
                    (v) => setRule('holdTimeout', v),
                    'Hold timeout',
                  )}
                </RuleRow>
                <RuleRow
                  label="Appointment notes"
                  hint={
                    draft.rules.patientNotes
                      ? 'Notes typed when booking, by the patient or the desk, are kept'
                      : 'Notes typed when booking are discarded'
                  }
                  last
                >
                  <Toggle
                    value={draft.rules.patientNotes}
                    onChange={(v) => setRule('patientNotes', v)}
                    label="Keep notes typed when booking"
                    disabled={!mayEdit}
                  />
                </RuleRow>
                <p className="text-caption text-text-muted m-0 pt-2">
                  Each slot holds one patient and slots run back to back; slot length is set per
                  doctor in Doctors &amp; Departments.
                </p>
              </RuleCard>

              <RuleCard title="Cancellations & refunds" hint="When a patient cancels">
                <RuleRow
                  label="Cancellation cut-off"
                  hint={`For a ${EXAMPLE_APPOINTMENT_TIME} appointment the cut-off is ${cancelDeadline}`}
                >
                  {sel(
                    draft.rules.cancelBefore,
                    CANCEL_BEFORE_OPTIONS,
                    (v) => setRule('cancelBefore', v),
                    'Cancellation cut-off',
                  )}
                </RuleRow>
                <RuleRow
                  label="Refund before the cut-off"
                  hint={`Cancelling by ${cancelDeadline} refunds ${draft.rules.refundBefore} of the fee`}
                >
                  {sel(
                    draft.rules.refundBefore,
                    REFUND_OPTIONS,
                    (v) => setRule('refundBefore', v),
                    'Refund before the cut-off',
                  )}
                </RuleRow>
                <RuleRow
                  label="Refund after the cut-off"
                  hint={`Cancelling after ${cancelDeadline} refunds ${draft.rules.refundAfter}`}
                >
                  {sel(
                    draft.rules.refundAfter,
                    REFUND_OPTIONS,
                    (v) => setRule('refundAfter', v),
                    'Refund after the cut-off',
                  )}
                </RuleRow>
                <RuleRow
                  label="Refund the convenience fee"
                  hint={
                    draft.rules.refundFee
                      ? "A patient's refund includes Medibook's convenience fee"
                      : "Medibook's convenience fee is kept when a patient cancels"
                  }
                  last
                >
                  <Toggle
                    value={draft.rules.refundFee}
                    onChange={(v) => setRule('refundFee', v)}
                    label="Include the convenience fee in patient refunds"
                    disabled={!mayEdit}
                  />
                </RuleRow>
                <p className="text-caption text-text-muted m-0 pt-2">
                  When the hospital cancels, the patient always gets everything back, convenience
                  fee included.
                </p>
              </RuleCard>

              <RuleCard title="Token queue" hint="Applies to all departments">
                <RuleRow
                  label="Token counter"
                  hint={`Which counter token numbers come from. ${schedulingCopy(
                    tokenPolicy.scope,
                    tokenPolicy.pendingScope,
                    tokenPolicy.pendingEffectiveDate,
                    tokenScopeLabel,
                  )}`}
                >
                  <div className="w-52">
                    <Select
                      value={draft.token.scope}
                      options={TOKEN_SCOPE_OPTIONS}
                      onChange={(v) => setToken('scope', v)}
                      height={40}
                      aria-label="Token counter"
                      disabled={!mayEdit}
                    />
                  </div>
                </RuleRow>
                <RuleRow
                  label="Numbers start again"
                  hint={schedulingCopy(
                    tokenPolicy.reset,
                    tokenPolicy.pendingReset,
                    tokenPolicy.pendingEffectiveDate,
                    tokenResetLabel,
                  )}
                >
                  {sel(
                    draft.token.reset,
                    TOKEN_RESET_OPTIONS,
                    (v) => setToken('reset', v),
                    'Token numbers start again',
                  )}
                </RuleRow>
                <RuleRow
                  label="Reuse cancelled numbers"
                  hint={
                    draft.token.reuseCancelled
                      ? 'A cancelled token’s number is given to the next patient who joins'
                      : 'Cancelled numbers are skipped'
                  }
                >
                  <Toggle
                    value={draft.token.reuseCancelled}
                    onChange={(v) => setToken('reuseCancelled', v)}
                    label="Reuse cancelled token numbers"
                    disabled={!mayEdit}
                  />
                </RuleRow>
                <RuleRow
                  label="Expected consultation time"
                  hint="Minutes per patient for wait estimates, when a doctor has no time of their own"
                >
                  <div className="w-32.5">
                    <Field label="" htmlFor="consult-minutes" error={errorFor('consultMinutes')}>
                      <TextInput
                        id="consult-minutes"
                        value={draft.rules.consultMinutes}
                        onChange={(v) => setRule('consultMinutes', v.replace(/[^0-9]/g, ''))}
                        height={40}
                        inputMode="numeric"
                        aria-label="Expected consultation time in minutes"
                        disabled={!mayEdit}
                      />
                    </Field>
                  </div>
                </RuleRow>
                <RuleRow
                  label="Offer No-show after"
                  hint={`After ${draft.rules.noShowCalls} the queue offers to mark the patient a no-show`}
                >
                  {sel(
                    draft.rules.noShowCalls,
                    NO_SHOW_CALL_OPTIONS,
                    (v) => setRule('noShowCalls', v),
                    'Offer No-show after',
                  )}
                </RuleRow>
                <RuleRow label="Patients can cancel a token" hint={tokenCancelCopy}>
                  <div className="w-52">
                    <Select
                      value={draft.rules.tokenCancel}
                      options={withCurrent(TOKEN_CANCEL_OPTIONS, draft.rules.tokenCancel)}
                      onChange={(v) => setRule('tokenCancel', v)}
                      height={40}
                      aria-label="How long patients can cancel a token"
                      disabled={!mayEdit}
                    />
                  </div>
                </RuleRow>
                <RuleRow
                  label="Full names on the queue display"
                  hint={
                    draft.rules.displayFullName
                      ? 'The waiting-room screen shows each patient’s full name'
                      : 'The waiting-room screen shows first name and last initial'
                  }
                  last
                >
                  <Toggle
                    value={draft.rules.displayFullName}
                    onChange={(v) => setRule('displayFullName', v)}
                    label="Show full names on the queue display"
                    disabled={!mayEdit}
                  />
                </RuleRow>
              </RuleCard>

              <RuleCard title="Token label" hint="How a token number is printed and shown">
                <RuleRow label="Format" hint={tokenPreviewCopy}>
                  <div className="w-40">
                    <Field label="" htmlFor="token-format" error={errorFor('tokenFormat')}>
                      <TextInput
                        id="token-format"
                        value={draft.token.format}
                        onChange={(v) => setToken('format', v)}
                        height={40}
                        aria-label="Token label format"
                        disabled={!mayEdit}
                      />
                    </Field>
                  </div>
                </RuleRow>
                <RuleRow label="Prefix" hint="Printed for {PREFIX}">
                  <div className="w-32.5">
                    <Field label="" htmlFor="token-prefix" error={errorFor('tokenPrefix')}>
                      <TextInput
                        id="token-prefix"
                        value={draft.token.prefix}
                        onChange={(v) => setToken('prefix', v)}
                        height={40}
                        aria-label="Token prefix"
                        disabled={!mayEdit}
                      />
                    </Field>
                  </div>
                </RuleRow>
                <RuleRow label="Online marker" hint="Printed for {SRC} on an online booking">
                  <div className="w-32.5">
                    <Field label="" htmlFor="online-marker" error={errorFor('onlineMarker')}>
                      <TextInput
                        id="online-marker"
                        value={draft.token.onlineMarker}
                        onChange={(v) => setToken('onlineMarker', v)}
                        height={40}
                        aria-label="Online booking marker"
                        disabled={!mayEdit}
                      />
                    </Field>
                  </div>
                </RuleRow>
                <RuleRow label="Walk-in marker" hint="Printed for {SRC} on a walk-in">
                  <div className="w-32.5">
                    <Field label="" htmlFor="walk-in-marker" error={errorFor('offlineMarker')}>
                      <TextInput
                        id="walk-in-marker"
                        value={draft.token.offlineMarker}
                        onChange={(v) => setToken('offlineMarker', v)}
                        height={40}
                        aria-label="Walk-in marker"
                        disabled={!mayEdit}
                      />
                    </Field>
                  </div>
                </RuleRow>
                <RuleRow
                  label="Separate number ranges"
                  hint={
                    draft.token.separateRanges
                      ? 'Online and walk-in tokens count within their own ranges'
                      : 'Online and walk-in tokens share one count'
                  }
                  last={!draft.token.separateRanges}
                >
                  <Toggle
                    value={draft.token.separateRanges}
                    onChange={(v) => setToken('separateRanges', v)}
                    label="Give online and walk-in tokens separate number ranges"
                    disabled={!mayEdit}
                  />
                </RuleRow>
                {draft.token.separateRanges && (
                  <div className="flex flex-col gap-3 pt-3.5">
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Online from" htmlFor="online-from">
                        <TextInput
                          id="online-from"
                          value={draft.token.onlineFrom}
                          onChange={(v) => setToken('onlineFrom', v.replace(/[^0-9]/g, ''))}
                          height={40}
                          inputMode="numeric"
                          disabled={!mayEdit}
                        />
                      </Field>
                      <Field label="Online to" htmlFor="online-to">
                        <TextInput
                          id="online-to"
                          value={draft.token.onlineTo}
                          onChange={(v) => setToken('onlineTo', v.replace(/[^0-9]/g, ''))}
                          height={40}
                          inputMode="numeric"
                          disabled={!mayEdit}
                        />
                      </Field>
                      <Field label="Walk-in from" htmlFor="walk-in-from">
                        <TextInput
                          id="walk-in-from"
                          value={draft.token.walkInFrom}
                          onChange={(v) => setToken('walkInFrom', v.replace(/[^0-9]/g, ''))}
                          height={40}
                          inputMode="numeric"
                          disabled={!mayEdit}
                        />
                      </Field>
                      <Field label="Walk-in to" htmlFor="walk-in-to">
                        <TextInput
                          id="walk-in-to"
                          value={draft.token.walkInTo}
                          onChange={(v) => setToken('walkInTo', v.replace(/[^0-9]/g, ''))}
                          height={40}
                          inputMode="numeric"
                          disabled={!mayEdit}
                        />
                      </Field>
                    </div>
                    {errorFor('tokenRanges') && (
                      <span className="text-caption text-d-700 flex items-center gap-1.5">
                        <Icon name="triangle-alert" size={13} /> {errorFor('tokenRanges')}
                      </span>
                    )}
                  </div>
                )}
                <p className="text-caption text-text-muted m-0 pt-2">
                  Placeholders: {'{SEQ}'} or {'{SEQ:3}'} the number (once), {'{SRC}'} the marker,{' '}
                  {'{PREFIX}'}, {'{DOC}'} the doctor’s code, {'{DEPT}'} the department’s code,{' '}
                  {'{DATE}'} the date. Changes apply to new tokens at once.
                </p>
              </RuleCard>

              <RuleCard title="Fees & patient records">
                <RuleRow
                  label="Follow-up window (days)"
                  hint={
                    feeDays > 0
                      ? `A return visit within ${feeDays} ${feeDays === 1 ? 'day' : 'days'} is charged the doctor’s follow-up fee (the consultation fee if they have none)`
                      : 'Every visit is charged the consultation fee'
                  }
                >
                  <div className="w-32.5">
                    <Field label="" htmlFor="fee-validity" error={errorFor('feeValidity')}>
                      <TextInput
                        id="fee-validity"
                        value={draft.rules.feeValidity}
                        onChange={(v) => setRule('feeValidity', v.replace(/[^0-9]/g, ''))}
                        height={40}
                        inputMode="numeric"
                        aria-label="Follow-up window in days"
                        disabled={!mayEdit}
                      />
                    </Field>
                  </div>
                </RuleRow>
                <RuleRow
                  label="Approve patient detail changes"
                  hint={
                    draft.rules.patientEditApproval
                      ? 'A desk edit to a patient’s details waits for an admin to approve it'
                      : 'Desk edits to patient details apply at once'
                  }
                  last
                >
                  <Toggle
                    value={draft.rules.patientEditApproval}
                    onChange={(v) => setRule('patientEditApproval', v)}
                    label="Require approval for desk edits to patient details"
                    disabled={!mayEdit}
                  />
                </RuleRow>
                <p className="text-caption text-text-muted m-0 pt-2">
                  Consultation and follow-up fees are set per doctor in Doctors &amp; Departments.
                </p>
              </RuleCard>
            </div>
            <Card pad={16} className="flex items-start gap-2.5">
              <Icon name="info" size={16} className="text-blue mt-0.5 flex-none" />
              <span className="text-body text-text-body">
                {estimate ? (
                  <>
                    Doctors&apos; weekly sessions currently hold{' '}
                    <span className="font-semibold">≈ {estimate.avg} slots</span> each (from{' '}
                    {estimate.min} to {estimate.max}), one patient per slot.
                  </>
                ) : (
                  <>No doctor has an active weekly session yet, so no slots are generated.</>
                )}{' '}
                Booking is open across the{' '}
                <span className="font-semibold">{horizonDays}-day horizon</span> (to{' '}
                {fmtDate(horizonEnd)}, {horizonOpenDays} open days). Slots &amp; Availability
                generates within it, minus anything on the holiday calendar.
              </span>
            </Card>
          </>
        )}

        {sec === 'Numbering' && (
          <NumberingSettings
            series={numbering}
            bases={{ mrn: base.mrn, booking: base.booking, receipt: base.receipt }}
            drafts={{ mrn: draft.mrn, booking: draft.booking, receipt: draft.receipt }}
            onChange={setNumbering}
            errorFor={(kind, field) => errorFor(numberingErrorKey(kind, field))}
            mayEdit={mayEdit}
          />
        )}

        {sec === 'Notifications' && (
          <>
            <Card pad={14} className="flex items-center gap-2.5">
              <Icon name="info" size={16} className="text-text-muted flex-none" />
              <span className="text-body text-text-muted">
                Medibook sends these automatically. Switching individual messages off is coming
                later.
              </span>
            </Card>
            <Card pad={28}>
              <SettingsHead info="Sent by SMS, WhatsApp and the Medibook app whenever Medibook has a message template for the event. App reminders wait out quiet hours (9 pm–8 am).">
                Patient Messages
              </SettingsHead>
              {PATIENT_MESSAGES.map(([title, sub]) => (
                <NotificationRow key={title} title={title} sub={sub} status="Always sent" />
              ))}
              <div className="text-caption text-text-muted mt-4 flex items-center gap-1.5">
                <Icon name="megaphone" size={14} /> The wording of these messages is in Messaging,
                where each event and channel has its own template.
              </div>
            </Card>
            <Card pad={28}>
              <SettingsHead info="Emails about billing and settlements, sent to the hospital's staff accounts.">
                Staff Emails
              </SettingsHead>
              {STAFF_EMAILS.map(([title, sub, status]) => (
                <NotificationRow key={title} title={title} sub={sub} status={status} />
              ))}
            </Card>
          </>
        )}

        {(mayEdit || canEditBank) && (
          <UnsavedBar
            dirty={dirty}
            busy={saving}
            onSave={() => void save()}
            onDiscard={resetDraft}
            saveLabel="Save Settings"
            dirtyLabel={`Unsaved changes in ${sec}`}
          />
        )}
      </div>

      <ConfirmModal
        open={blocked}
        title="Leave without saving?"
        body="Your hospital settings edits have not been saved. Hours, cut-offs and profile details will stay as they were."
        confirmLabel="Discard changes"
        danger
        onClose={keepEditing}
        onConfirm={discard}
      />
    </div>
  );
}

/** One automatic message: what it is, and whether it is sent. */
function NotificationRow({ title, sub, status }: { title: string; sub: string; status: string }) {
  return (
    <div className="border-border-soft flex items-center gap-4 border-b py-4">
      <div className="flex-1">
        <div className="text-body text-text-strong font-medium">{title}</div>
        <div className="text-caption text-text-muted">{sub}</div>
      </div>
      <span className="text-caption text-text-muted flex-none font-medium">{status}</span>
    </div>
  );
}
