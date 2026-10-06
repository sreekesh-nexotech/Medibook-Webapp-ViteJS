import { type ChangeEvent, type MouseEvent, useState } from 'react';
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
  TokenPolicy,
} from '@/features/settings/domain/entities/settings.entities';
import { useHospitalImageUrlQuery } from '@/features/settings/application/queries/useHospitalImageUrlQuery';
import { useReplaceHospitalHoursMutation } from '@/features/settings/application/queries/useReplaceHospitalHoursMutation';
import { useSaveBankAccountMutation } from '@/features/settings/application/queries/useSaveBankAccountMutation';
import { useUpdateHospitalProfileMutation } from '@/features/settings/application/queries/useUpdateHospitalProfileMutation';
import { useUpdateHospitalRuleSettingsMutation } from '@/features/settings/application/queries/useUpdateHospitalRuleSettingsMutation';
import { useUpdateTokenScopeMutation } from '@/features/settings/application/queries/useUpdateTokenScopeMutation';
import { useUploadHospitalImageMutation } from '@/features/settings/application/queries/useUploadHospitalImageMutation';
import {
  type BankForm,
  FEE_VALIDITY_MAX_DAYS,
  HOLD_TIMEOUT_SERVER_OPTIONS,
  type HoursForm,
  type ProfileForm,
  type RulesForm,
  SETTINGS_FORM_SECTIONS,
  type SettingsForm,
  type SettingsFormSection,
  bankInput,
  hasMixedHours,
  hoursFromForm,
  isSectionDirty,
  profileChanges,
  rulesChanges,
  schemeForScope,
  scopeForScheme,
  toBankForm,
  toHoursForm,
  toProfileForm,
  toRulesForm,
  withCurrent,
  withoutSections,
} from '@/features/settings/application/store/settings.form';
import {
  CANCEL_BEFORE_OPTIONS,
  CANONICAL_TOKEN_SCHEME,
  CLOSE_TIME_OPTIONS,
  OPEN_TIME_OPTIONS,
  SCHEDULING_HORIZON_OPTIONS,
  TOKEN_SCHEME_OPTIONS,
  cancellationDeadline,
  durationCopy,
  openDaysInHorizon,
  parseCount,
  parseDurationMinutes,
  tokenSeriesCopy,
} from '@/features/settings/application/store/settings.rules';

import { RuleCard } from './RuleCard';
import { RuleRow } from './RuleRow';
import { SettingsHead } from './SettingsHead';

type SettingsSection =
  'General' | 'Management' | 'System Rules' | 'Working Hours' | 'Notifications';

const SETTINGS_NAV: readonly { readonly id: SettingsSection; readonly icon: IconName }[] = [
  { id: 'General', icon: 'building-2' },
  { id: 'Management', icon: 'layout-grid' },
  { id: 'System Rules', icon: 'sliders-horizontal' },
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

const PATIENT_COMMS: readonly [string, string, string][] = [
  ['confirm', 'Appointment Confirmation', 'Notify the patient when a booking is confirmed'],
  ['reminder', 'Visit Reminder', 'Remind patients before their appointment'],
];

const ADMIN_ALERTS: readonly [string, string, string][] = [
  ['settleReceived', 'Settlement Received', 'When a Medibook transfer reaches your account'],
  ['settleOverdue', 'Settlement Overdue', 'When an expected settlement is late'],
  ['quotaLow', 'Plan Quota Low', 'When online-appointment credits are running out'],
];

/** The illustrative appointment the cancellation example is written against. */
const EXAMPLE_APPOINTMENT_TIME = '2:00 pm';

/** Shown on every control the backend has no field for (H2 gap list). */
const NOT_AVAILABLE_HINT = 'Not yet available from the server — this setting is not saved.';
const NOT_AVAILABLE_PLACEHOLDER = 'Not available';
const PLATFORM_MANAGED_HINT = 'Managed by Medibook — contact support to change it.';

/** Fallback artwork while the hospital has no logo of its own. */
const DEFAULT_LOGO_SRC = '/assets/medibook-mark.svg';

/** Landline or mobile: 10 or 11 digits once separators are stripped. */
const MIN_PHONE_DIGITS = 10;
const MAX_PHONE_DIGITS = 11;

const MAX_LATITUDE = 90;
const MAX_LONGITUDE = 180;

/** The map box is a stylised projection of this area (degrees). */
const MAP_ORIGIN_LAT = 12.84;
const MAP_ORIGIN_LNG = 77.54;
const MAP_SPAN_DEG = 0.14;
const MAP_COORD_DECIMALS = 4;
const PERCENT = 100;
const MAP_CENTRE_PCT = 50;

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
  | 'bankHolder'
  | 'bankName'
  | 'bankAccount'
  | 'bankIfsc'
  | 'bankUpi';

type SettingsErrors = Partial<Record<SettingsErrorKey, string>>;

/** Backend field name → the inline error slot it belongs to. */
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
  account_holder: 'bankHolder',
  bank_name: 'bankName',
  account_number: 'bankAccount',
  ifsc: 'bankIfsc',
  upi_id: 'bankUpi',
};

/** What each section is called in a "not saved" message. */
const SECTION_LABEL: Readonly<Record<SettingsFormSection, string>> = {
  profile: 'Profile & location',
  hours: 'Working hours',
  rules: 'System rules',
  token: 'Token scheme',
  bank: 'Bank details',
};

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
    errors.feeValidity = `Fee validity must be 0–${FEE_VALIDITY_MAX_DAYS} days.`;
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
    errors.bankIfsc = 'IFSC looks like HDFC0001234 — 4 letters, a zero, then 6 characters.';
  }
  if (b.upi.trim() !== '' && !UPI_PATTERN.test(b.upi.trim())) {
    errors.bankUpi = 'UPI ID looks like name@bank.';
  }
}

/** Server field errors, mapped onto this screen's inline slots. */
function serverFieldErrors(failure: Failure): SettingsErrors {
  const out: SettingsErrors = {};
  for (const [field, messages] of Object.entries(failure.fieldErrors)) {
    const key = SERVER_FIELD_KEY[field];
    const first = messages[0];
    if (key && first) out[key] = first;
  }
  return out;
}

/** Map-box pin position for the saved coordinates (inverse of the click handler). */
function pinFor(lat: string, lng: string): { readonly x: number; readonly y: number } {
  const la = Number(lat);
  const ln = Number(lng);
  if (lat.trim() === '' || lng.trim() === '' || !Number.isFinite(la) || !Number.isFinite(ln)) {
    return { x: MAP_CENTRE_PCT, y: MAP_CENTRE_PCT };
  }
  const clamp = (n: number) => Math.max(0, Math.min(PERCENT, Math.round(n)));
  return {
    x: clamp(((ln - MAP_ORIGIN_LNG) / MAP_SPAN_DEG) * PERCENT),
    y: clamp((1 - (la - MAP_ORIGIN_LAT) / MAP_SPAN_DEG) * PERCENT),
  };
}

/** The bank section's data, which loads (and may be refused) separately. */
export type BankAccountsState =
  | { readonly status: 'hidden' }
  | { readonly status: 'loading' }
  | { readonly status: 'error'; readonly retry: () => void }
  | { readonly status: 'ready'; readonly account: BankAccount | null };

interface SettingsEditorProps {
  profile: HospitalProfile;
  rules: HospitalRuleSettings;
  hours: readonly HospitalHoursDay[];
  tokenPolicy: TokenPolicy;
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
 * Controls the backend has no field for stay visible but disabled, with
 * `NOT_AVAILABLE_HINT` — they are never saved and never show invented values.
 */
export function SettingsEditor({ profile, rules, hours, tokenPolicy, bank }: SettingsEditorProps) {
  const navigate = useNavigate();
  const { role: roleParam } = useParams();
  const role = isHospitalRole(roleParam) ? roleParam : 'admin';

  const { can } = usePermission();
  const mayEdit = can('Hospital Settings.edit');
  const canEditBank = bank.status === 'ready' && can('Billing & Settlements.edit');

  const updateProfile = useUpdateHospitalProfileMutation();
  const updateRules = useUpdateHospitalRuleSettingsMutation();
  const replaceHours = useReplaceHospitalHoursMutation();
  const updateTokenScope = useUpdateTokenScopeMutation();
  const saveBank = useSaveBankAccountMutation();
  const uploadImage = useUploadHospitalImageMutation();

  const bankAccount = bank.status === 'ready' ? bank.account : null;
  const base: SettingsForm = {
    profile: toProfileForm(profile),
    hours: toHoursForm(hours),
    rules: toRulesForm(rules),
    token: { scheme: schemeForScope(tokenPolicy.scope) },
    bank: toBankForm(bankAccount),
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
  const setScheme = (scheme: string) => setEdits((e) => ({ ...e, token: { scheme } }));
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
        return updateTokenScope.mutateAsync({
          scope: scopeForScheme(draft.token.scheme),
          version: tokenPolicy.version,
        });
      case 'bank':
        return saveBank.mutateAsync({ input: bankInput(draft.bank), existing: bankAccount });
    }
  };

  const save = async (): Promise<void> => {
    setAttempted(true);
    setServerErrors({});
    if (errorCount > 0) return;
    const sections = dirtySections.filter((s) => s !== 'bank' || canEditBank);
    if (sections.length === 0) return;
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
      if (isFailure(reason)) fieldErrors = { ...fieldErrors, ...serverFieldErrors(reason) };
      toast(`${SECTION_LABEL[section]} not saved — ${message}`, 'error');
    });

    setEdits((e) => withoutSections(e, saved));
    setServerErrors(fieldErrors);
    if (saved.length === sections.length) {
      setAttempted(false);
      toast(
        saved.includes('token')
          ? 'Settings saved — the new token scheme applies from tomorrow'
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
              toast(isFailure(error) ? error.message : 'The image could not be uploaded.', 'error');
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

  /** A rule the backend has no field for: visible, disabled, empty. */
  const unavailableSel = (ariaLabel: string) => (
    <div className="w-32.5">
      <Select
        value=""
        placeholder={NOT_AVAILABLE_PLACEHOLDER}
        height={40}
        aria-label={ariaLabel}
        disabled
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
  const pin = pinFor(draft.profile.lat, draft.profile.lng);
  const hoursUnset = hours.length === 0;
  const hoursMixed = hasMixedHours(hours);
  const schemeOptions = withCurrent(TOKEN_SCHEME_OPTIONS, draft.token.scheme);
  const pendingScheme = tokenPolicy.pendingScope ? schemeForScope(tokenPolicy.pendingScope) : null;

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
              {dirty && !active && <span className="bg-y-600 ml-auto size-2 rounded-full" />}
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
            <Icon name="triangle-alert" size={16} className="text-d-500 flex-none" />
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
                  <img
                    src={logoSrc ?? DEFAULT_LOGO_SRC}
                    className={cn('object-cover', logoSrc ? 'h-full w-full' : 'size-12')}
                    alt=""
                  />
                </div>
                <div>
                  <label className="inline-block">
                    <input
                      type="file"
                      accept={acceptFor('logo')}
                      className="hidden"
                      disabled={!mayEdit || uploadImage.isPending}
                      onChange={pickImage('logo', (id) => setProfile('logoFileId', id))}
                    />
                    <span className="text-body border-text-navy text-text-navy inline-flex cursor-pointer items-center gap-2 rounded-lg border bg-white px-3.5 py-2 font-medium">
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
                <Field label="About" className="col-span-full" hint={NOT_AVAILABLE_HINT}>
                  <textarea
                    value=""
                    placeholder={NOT_AVAILABLE_PLACEHOLDER}
                    disabled
                    className="rounded-input border-border text-body-lg text-text-strong box-border h-23 w-full resize-none border p-3.5"
                  ></textarea>
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
                    className="hidden"
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
                <div className="pointer-events-none block opacity-50">
                  <ImageUpload label="Reception" h={130} />
                </div>
                <div className="pointer-events-none block opacity-50">
                  <ImageUpload label="Add photo" h={130} icon="plus" />
                </div>
              </div>
              <div className="text-caption text-text-muted mt-4">
                Only the cover photo is stored today — more gallery photos are not yet available
                from the server.
              </div>
            </Card>

            <Card pad={28}>
              <SettingsHead info="Patients see your location and get directions in the Medibook app. Click the map to drop the pin.">
                Location
              </SettingsHead>
              <div className="flex items-stretch gap-5">
                <div className="flex flex-1 flex-col gap-4">
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
                        onChange={(v) => setProfile('lat', v)}
                        inputMode="decimal"
                        disabled={!mayEdit}
                      />
                    </Field>
                    <Field label="Longitude" error={errorFor('lng')}>
                      <TextInput
                        value={draft.profile.lng}
                        onChange={(v) => setProfile('lng', v)}
                        inputMode="decimal"
                        disabled={!mayEdit}
                      />
                    </Field>
                  </div>
                  <div className="text-caption text-text-muted flex items-center gap-1.5">
                    <Icon name="map-pin" size={14} /> Click anywhere on the map to set the location
                    pin.
                  </div>
                </div>
                <div
                  onClick={(e: MouseEvent<HTMLDivElement>) => {
                    if (!mayEdit) return;
                    const r = e.currentTarget.getBoundingClientRect();
                    const x = Math.max(
                      0,
                      Math.min(PERCENT, Math.round(((e.clientX - r.left) / r.width) * PERCENT)),
                    );
                    const y = Math.max(
                      0,
                      Math.min(PERCENT, Math.round(((e.clientY - r.top) / r.height) * PERCENT)),
                    );
                    setEdits((ed) => ({
                      ...ed,
                      profile: {
                        ...(ed.profile ?? base.profile),
                        lat: (MAP_ORIGIN_LAT + (1 - y / PERCENT) * MAP_SPAN_DEG).toFixed(
                          MAP_COORD_DECIMALS,
                        ),
                        lng: (MAP_ORIGIN_LNG + (x / PERCENT) * MAP_SPAN_DEG).toFixed(
                          MAP_COORD_DECIMALS,
                        ),
                      },
                    }));
                  }}
                  className="border-border relative min-h-50 flex-1 cursor-crosshair overflow-hidden rounded-lg border"
                  style={{ background: 'linear-gradient(135deg, #dbe7f3 0%, #cdddec 100%)' }}
                >
                  <svg width="100%" height="100%" className="absolute inset-0 opacity-50">
                    <path
                      d="M0 60 L400 90 M0 130 L400 100 M120 0 L150 240 M260 0 L240 240"
                      stroke="#9fb6cd"
                      strokeWidth="3"
                      fill="none"
                    />
                  </svg>
                  <div
                    className="text-d-500 absolute -translate-x-1/2 -translate-y-full"
                    style={{ top: `${pin.y}%`, left: `${pin.x}%` }}
                  >
                    <Icon name="map-pin" size={36} />
                  </div>
                  <span className="text-caption text-text-muted absolute right-3 bottom-2.5">
                    Click to drop pin
                  </span>
                </div>
              </div>
            </Card>

            <Card pad={28}>
              <SettingsHead info="Medibook releases online-booking settlements to this account. Operations sees these details (masked) on your hospital profile.">
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
                Hospital-wide defaults. A doctor&apos;s custom availability or fee settings override
                these. Each rule shows what it does with its current value.
              </span>
              <InfoDot text="These apply to every department and doctor unless a doctor has custom settings, which always take precedence." />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <RuleCard title="Appointment Rules" hint="Applies to all new appointments">
                <RuleRow
                  label="Default consultation duration"
                  hint="Slot length is set per doctor in Doctors & Departments — no hospital-wide default is stored."
                >
                  {unavailableSel('Default consultation duration')}
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
                  label="Max appointments per slot"
                  hint="Each slot holds one patient — fixed by the server, not configurable here."
                >
                  {unavailableSel('Maximum appointments per slot')}
                </RuleRow>
                <RuleRow
                  label="Buffer time between appointments"
                  hint="Slots run back to back — no buffer is stored by the server."
                  last
                >
                  {unavailableSel('Buffer time between appointments')}
                </RuleRow>
              </RuleCard>

              <RuleCard title="Cancellation & No-show Rules">
                <RuleRow label="Allow patient cancellation" hint={NOT_AVAILABLE_HINT}>
                  <Toggle
                    value={false}
                    onChange={() => undefined}
                    label="Allow patients to cancel their own booking"
                    disabled
                  />
                </RuleRow>
                <RuleRow
                  label="Cancellation allowed before"
                  hint={`For a ${EXAMPLE_APPOINTMENT_TIME} appointment the cut-off is ${cancelDeadline}; later cancellations fall outside the refund window`}
                >
                  {sel(
                    draft.rules.cancelBefore,
                    CANCEL_BEFORE_OPTIONS,
                    (v) => setRule('cancelBefore', v),
                    'Cancellation cut-off',
                  )}
                </RuleRow>
                <RuleRow label="Auto mark No-show after" hint={NOT_AVAILABLE_HINT} last>
                  {unavailableSel('Auto mark No-show after')}
                </RuleRow>
              </RuleCard>

              <RuleCard title="Token Queue Behaviour" hint="Applies to all departments">
                <RuleRow
                  label="Token scheme"
                  hint={`Tokens issue as ${tokenSeriesCopy(draft.token.scheme)}${
                    draft.token.scheme === CANONICAL_TOKEN_SCHEME
                      ? ' — the format the patient app shows'
                      : ' — the patient app expects the hospital-wide T-001 series'
                  }. ${
                    pendingScheme && tokenPolicy.pendingEffectiveDate
                      ? `Switching to ${pendingScheme} on ${fmtDate(tokenPolicy.pendingEffectiveDate)}.`
                      : 'A change applies from tomorrow.'
                  }`}
                >
                  <div className="w-45">
                    <Select
                      value={draft.token.scheme}
                      options={schemeOptions}
                      onChange={setScheme}
                      height={40}
                      aria-label="Token scheme"
                      disabled={!mayEdit}
                    />
                  </div>
                </RuleRow>
                <RuleRow label="Token generation" hint={NOT_AVAILABLE_HINT}>
                  {unavailableSel('Token generation')}
                </RuleRow>
                <RuleRow label="Show token number to patient" hint={NOT_AVAILABLE_HINT}>
                  <Toggle
                    value={false}
                    onChange={() => undefined}
                    label="Show the token number to the patient"
                    disabled
                  />
                </RuleRow>
                <RuleRow label="Allow hold token" hint={NOT_AVAILABLE_HINT}>
                  <Toggle
                    value={false}
                    onChange={() => undefined}
                    label="Allow a token to be held"
                    disabled
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
                <RuleRow label="Grace period" hint={NOT_AVAILABLE_HINT}>
                  {unavailableSel('Grace period')}
                </RuleRow>
                <RuleRow label="After grace" hint={NOT_AVAILABLE_HINT} last>
                  {unavailableSel('After the grace period')}
                </RuleRow>
              </RuleCard>

              <RuleCard
                title="Consultation Fees"
                hint="Default OP fee for doctors without a custom fee"
              >
                <RuleRow
                  label="OP Consultation Fee"
                  hint="Fees are set per doctor — no hospital default is stored."
                >
                  <div className="w-32.5">
                    <TextInput
                      id="op-fee"
                      value=""
                      placeholder={NOT_AVAILABLE_PLACEHOLDER}
                      height={40}
                      aria-label="OP consultation fee in rupees"
                      disabled
                    />
                  </div>
                </RuleRow>
                <RuleRow
                  label="Validity (days)"
                  hint={
                    feeDays > 0
                      ? `A follow-up within ${feeDays} ${feeDays === 1 ? 'day' : 'days'} is not charged again`
                      : 'Every visit is charged'
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
                        aria-label="Fee validity in days"
                        disabled={!mayEdit}
                      />
                    </Field>
                  </div>
                </RuleRow>
                <RuleRow label="Apply to all departments" hint={NOT_AVAILABLE_HINT} last>
                  <Toggle
                    value={false}
                    onChange={() => undefined}
                    label="Apply the default fee to all departments"
                    disabled
                  />
                </RuleRow>
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

        {sec === 'Notifications' && (
          <>
            <Card pad={14} className="flex items-center gap-2.5">
              <Icon name="info" size={16} className="text-text-muted flex-none" />
              <span className="text-body text-text-muted">
                Notification preferences are not yet available from the server — these switches are
                not saved.
              </span>
            </Card>
            <Card pad={28}>
              <SettingsHead info="Messages the hospital sends to patients via the Medibook app.">
                Patient Communications
              </SettingsHead>
              {PATIENT_COMMS.map(([k, t, s]) => (
                <div key={k} className="border-border-soft flex items-center gap-4 border-b py-4">
                  <div className="flex-1">
                    <div className="text-body text-text-strong font-medium">{t}</div>
                    <div className="text-caption text-text-muted">{s}</div>
                  </div>
                  <Toggle value={false} onChange={() => undefined} label={t} disabled />
                </div>
              ))}
              <div className="text-caption text-text-muted mt-4 flex items-center gap-1.5">
                <Icon name="megaphone" size={14} /> The wording of these messages is edited in
                Messaging, where each event and channel has its own template.
              </div>
            </Card>
            <Card pad={28}>
              <SettingsHead info="Alerts for the hospital admin about billing & settlements.">
                Admin Alerts
              </SettingsHead>
              {ADMIN_ALERTS.map(([k, t, s]) => (
                <div key={k} className="border-border-soft flex items-center gap-4 border-b py-4">
                  <div className="flex-1">
                    <div className="text-body text-text-strong font-medium">{t}</div>
                    <div className="text-caption text-text-muted">{s}</div>
                  </div>
                  <Toggle value={false} onChange={() => undefined} label={t} disabled />
                </div>
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
