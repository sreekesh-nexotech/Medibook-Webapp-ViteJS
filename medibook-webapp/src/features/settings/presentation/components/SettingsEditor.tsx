import { type ChangeEvent, useState } from 'react';

import type { Failure } from '@/core/error/failure';
import { isFailure } from '@/core/error/failure';

import { usePermission } from '@/shared/hooks/usePermission';
import { useUnsavedChanges } from '@/shared/hooks/useUnsavedChanges';
import { cn } from '@/shared/lib/cn';
import { describeFailure, mapServerErrors } from '@/shared/lib/serverErrors';
import {
  email as validateEmail,
  pincode as validatePincode,
  required,
} from '@/shared/lib/validate';
import { Card } from '@/shared/ui/Card';
import { ConfirmModal } from '@/shared/ui/ConfirmModal';
import { FormErrorSummary } from '@/shared/ui/FormErrorSummary';
import { Icon } from '@/shared/ui/Icon';
import type { IconName } from '@/shared/ui/icon-registry';
import { toast } from '@/shared/ui/toast/toast.store';
import { UnsavedBar } from '@/shared/ui/UnsavedBar';

import type {
  HospitalHoursDay,
  HospitalImagePurpose,
  HospitalProfile,
  HospitalRuleSettings,
  TokenPolicy,
} from '@/features/settings/domain/entities/settings.entities';
import { useDisplayDeviceAccess } from '@/features/settings/application/queries/useDisplayDeviceAccess';
import { useReplaceHospitalHoursMutation } from '@/features/settings/application/queries/useReplaceHospitalHoursMutation';
import { useUpdateHospitalProfileMutation } from '@/features/settings/application/queries/useUpdateHospitalProfileMutation';
import { useUpdateHospitalRuleSettingsMutation } from '@/features/settings/application/queries/useUpdateHospitalRuleSettingsMutation';
import { useUpdateTokenPolicyMutation } from '@/features/settings/application/queries/useUpdateTokenPolicyMutation';
import { useUploadHospitalImageMutation } from '@/features/settings/application/queries/useUploadHospitalImageMutation';
import {
  type HoursForm,
  type ProfileForm,
  type RulesForm,
  SETTINGS_FORM_SECTIONS,
  type SettingsForm,
  type SettingsFormSection,
  type TokenForm,
  dirtyRuleFields,
  hoursErrors,
  hoursFromForm,
  isSectionDirty,
  profileChanges,
  rulesChanges,
  rulesErrors,
  toHoursForm,
  toProfileForm,
  toRulesForm,
  toTokenForm,
  tokenChanges,
  tokenErrors,
  withoutSections,
} from '@/features/settings/application/store/settings.form';

import { BankAccountsPanel, type BankAccountsState } from './BankAccountsPanel';
import { CountersPanel } from './CountersPanel';
import { DisplayDevicesPanel } from './DisplayDevicesPanel';
import { NumberingPanel } from './NumberingPanel';
import { SettingsBookingSection } from './SettingsBookingSection';
import { SettingsGeneralSection } from './SettingsGeneralSection';
import { SettingsHoursSection } from './SettingsHoursSection';
import { SettingsManagementSection } from './SettingsManagementSection';
import { SettingsNotificationsSection } from './SettingsNotificationsSection';
import { SettingsQueueSection } from './SettingsQueueSection';
import { SettingsReceiptsSection } from './SettingsReceiptsSection';
import type { FieldErrorsOf, SettingsSection } from './settingsEditor.types';

export type { BankAccountsState } from './BankAccountsPanel';

const SETTINGS_NAV: readonly { readonly id: SettingsSection; readonly icon: IconName }[] = [
  { id: 'General', icon: 'building-2' },
  { id: 'Booking & Cancellation', icon: 'calendar-check' },
  { id: 'Queue & Tokens', icon: 'ticket' },
  { id: 'Numbering', icon: 'hash' },
  { id: 'Receipts & Printing', icon: 'printer' },
  { id: 'Counters', icon: 'contact' },
  { id: 'Display Screens', icon: 'monitor' },
  { id: 'Working Hours', icon: 'clock' },
  { id: 'Bank & Payouts', icon: 'landmark' },
  { id: 'Management', icon: 'layout-grid' },
  { id: 'Notifications', icon: 'bell' },
];

/** Which nav section shows each rulebook field (for the unsaved-edits dot). */
const RULE_SECTION: Readonly<Record<keyof RulesForm, SettingsSection>> = {
  bookingWindowDays: 'Booking & Cancellation',
  onlineRequiresApproval: 'Booking & Cancellation',
  holdTimeoutMinutes: 'Booking & Cancellation',
  cancellationCutoffHours: 'Booking & Cancellation',
  refundBeforePct: 'Booking & Cancellation',
  refundAfterPct: 'Booking & Cancellation',
  refundIncludesConvenienceFee: 'Booking & Cancellation',
  followUpWindowDays: 'Booking & Cancellation',
  patientEditRequiresApproval: 'Booking & Cancellation',
  patientNotesEnabled: 'Booking & Cancellation',
  noShowCallAttempts: 'Queue & Tokens',
  tokenCancelLimitMin: 'Queue & Tokens',
  expectedConsultMinutes: 'Queue & Tokens',
  displayShowFullName: 'Queue & Tokens',
  receiptPaper: 'Receipts & Printing',
  receiptShowStaff: 'Receipts & Printing',
  deskPaymentMethods: 'Receipts & Printing',
};

/** What each draft is called in a "not saved" message and the error summary. */
const SECTION_LABEL: Readonly<Record<SettingsFormSection, string>> = {
  profile: 'Hospital profile',
  hours: 'Working hours',
  rules: 'Hospital rules',
  token: 'Token policy',
};

/** Server field → form field, per resource (UAT-48). */
const PROFILE_SERVER_FIELDS = {
  name: 'name',
  legal_name: 'legalName',
  email: 'email',
  phone_e164: 'phone',
  website: 'website',
  address_line1: 'address1',
  address_line2: 'address2',
  address_line3: 'address3',
  city: 'city',
  state: 'state',
  pincode: 'pincode',
  lat: 'lat',
  lng: 'lng',
  logo_file_id: 'logoFileId',
  cover_file_id: 'coverFileId',
  stamp_file_id: 'stampFileId',
} as const;

const RULES_SERVER_FIELDS = {
  booking_window_days: 'bookingWindowDays',
  online_requires_approval: 'onlineRequiresApproval',
  hold_timeout_seconds: 'holdTimeoutMinutes',
  cancellation_cutoff_hours: 'cancellationCutoffHours',
  refund_before_cutoff_bp: 'refundBeforePct',
  refund_after_cutoff_bp: 'refundAfterPct',
  refund_includes_convenience_fee: 'refundIncludesConvenienceFee',
  follow_up_window_days: 'followUpWindowDays',
  no_show_call_attempts: 'noShowCallAttempts',
  token_cancel_limit_min: 'tokenCancelLimitMin',
  expected_consult_minutes: 'expectedConsultMinutes',
  patient_notes_enabled: 'patientNotesEnabled',
  receipt_paper: 'receiptPaper',
  receipt_show_staff: 'receiptShowStaff',
  patient_edit_requires_approval: 'patientEditRequiresApproval',
  display_show_full_name: 'displayShowFullName',
  desk_payment_methods: 'deskPaymentMethods',
} as const;

const TOKEN_SERVER_FIELDS = {
  scope: 'scope',
  reset: 'reset',
  format: 'format',
  prefix: 'prefix',
  online_marker: 'onlineMarker',
  offline_marker: 'offlineMarker',
  separate_ranges: 'separateRanges',
  online_range_start: 'onlineRangeStart',
  online_range_end: 'onlineRangeEnd',
  offline_range_start: 'offlineRangeStart',
  offline_range_end: 'offlineRangeEnd',
  reuse_cancelled: 'reuseCancelled',
  print_template_id: 'printTemplateId',
} as const;

/** `hours.2.closes_at` → day 2. */
function hoursDayOf(key: string): `${number}` | undefined {
  const match = /^hours\.(\d+)\./.exec(key);
  return match?.[1] === undefined ? undefined : (match[1] as `${number}`);
}

/** Landline or mobile: 10 or 11 digits once separators are stripped. */
const MIN_PHONE_DIGITS = 10;
const MAX_PHONE_DIGITS = 11;
const MAX_LATITUDE = 90;
const MAX_LONGITUDE = 180;
const WEBSITE_PATTERN = /^https?:\/\/[^\s.]+\.[^\s]+$/i;

function validateCoord(value: string, max: number, label: string): string | undefined {
  if (value.trim() === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) && Math.abs(n) <= max
    ? undefined
    : `${label} must be a number between -${max} and ${max}.`;
}

function profileErrors(p: ProfileForm): FieldErrorsOf<ProfileForm> {
  const out: FieldErrorsOf<ProfileForm> = {};
  const put = (key: keyof ProfileForm, message: string | undefined) => {
    if (message) out[key] = message;
  };
  put('name', required(p.name, 'Hospital name'));
  const digits = p.phone.replace(/\D/g, '');
  if (digits.length < MIN_PHONE_DIGITS || digits.length > MAX_PHONE_DIGITS) {
    out.phone = `Enter a ${MIN_PHONE_DIGITS}- or ${MAX_PHONE_DIGITS}-digit landline or mobile number.`;
  }
  put('email', validateEmail(p.email));
  if (p.website.trim() !== '' && !WEBSITE_PATTERN.test(p.website.trim())) {
    out.website = 'Enter the full address, starting with https://';
  }
  put('address1', required(p.address1, 'Address line 1'));
  put('city', required(p.city, 'City'));
  put('state', required(p.state, 'State'));
  put('pincode', validatePincode(p.pincode));
  put('lat', validateCoord(p.lat, MAX_LATITUDE, 'Latitude'));
  put('lng', validateCoord(p.lng, MAX_LONGITUDE, 'Longitude'));
  if ((p.lat.trim() === '') !== (p.lng.trim() === '')) {
    out[p.lat.trim() === '' ? 'lat' : 'lng'] = 'Enter both latitude and longitude, or neither.';
  }
  return out;
}

/** Client and server errors for every draft. */
interface EditorErrors {
  readonly profile: FieldErrorsOf<ProfileForm>;
  readonly rules: FieldErrorsOf<RulesForm>;
  readonly token: FieldErrorsOf<TokenForm>;
  readonly hours: Readonly<Record<number, string>>;
}

const NO_ERRORS: EditorErrors = { profile: {}, rules: {}, token: {}, hours: {} };

interface SettingsEditorProps {
  profile: HospitalProfile;
  rules: HospitalRuleSettings;
  hours: readonly HospitalHoursDay[];
  tokenPolicy: TokenPolicy;
  bank: BankAccountsState;
}

/**
 * The Hospital Settings editor (module H2). The four rule resources —
 * profile, rulebook, hours, token policy — share one draft per resource, a
 * sticky `UnsavedBar` and route-leave protection; switching sections keeps
 * every edit and a dot marks the sections that hold them (07·F10). Save
 * sends only the resources that changed, in parallel; one that fails keeps
 * its edits and shows the server's reasons on the fields (UAT-48).
 *
 * Numbering, counters, print templates, display screens and bank accounts
 * are lists: each row saves on its own from a dialog, outside the draft.
 */
export function SettingsEditor({ profile, rules, hours, tokenPolicy, bank }: SettingsEditorProps) {
  const { can, roleId } = usePermission();
  const mayEdit = can('Hospital Settings.edit');
  const devices = useDisplayDeviceAccess();

  const updateProfile = useUpdateHospitalProfileMutation();
  const updateRules = useUpdateHospitalRuleSettingsMutation();
  const replaceHours = useReplaceHospitalHoursMutation();
  const updateTokenPolicy = useUpdateTokenPolicyMutation();
  const uploadImage = useUploadHospitalImageMutation();

  const base: SettingsForm = {
    profile: toProfileForm(profile),
    hours: toHoursForm(hours),
    rules: toRulesForm(rules),
    token: toTokenForm(tokenPolicy),
  };

  const [sec, setSec] = useState<SettingsSection>('General');
  const [edits, setEdits] = useState<Partial<SettingsForm>>({});
  const [previews, setPreviews] = useState<Readonly<Record<string, string>>>({});
  const [serverErrors, setServerErrors] = useState<EditorErrors>(NO_ERRORS);
  const [summary, setSummary] = useState<readonly string[]>([]);
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);

  const draft: SettingsForm = { ...base, ...edits };
  const dirtySections = SETTINGS_FORM_SECTIONS.filter((s) => isSectionDirty(base, draft, s));
  const dirty = dirtySections.length > 0;

  const clientErrors: EditorErrors = {
    profile: dirtySections.includes('profile') ? profileErrors(draft.profile) : {},
    rules: dirtySections.includes('rules') ? rulesErrors(draft.rules) : {},
    token: dirtySections.includes('token') ? tokenErrors(draft.token) : {},
    hours: dirtySections.includes('hours') ? hoursErrors(draft.hours) : {},
  };
  const errorCount =
    Object.keys(clientErrors.profile).length +
    Object.keys(clientErrors.rules).length +
    Object.keys(clientErrors.token).length +
    Object.keys(clientErrors.hours).length;
  // Server errors show at once; client errors once a save was attempted.
  const shownProfile = attempted
    ? { ...serverErrors.profile, ...clientErrors.profile }
    : serverErrors.profile;
  const shownRules = attempted
    ? { ...serverErrors.rules, ...clientErrors.rules }
    : serverErrors.rules;
  const shownToken = attempted
    ? { ...serverErrors.token, ...clientErrors.token }
    : serverErrors.token;
  const shownHours = attempted
    ? { ...serverErrors.hours, ...clientErrors.hours }
    : serverErrors.hours;

  // Dot on every nav section that holds an unsaved edit.
  const dirtyNav = new Set<SettingsSection>();
  if (dirtySections.includes('profile')) dirtyNav.add('General');
  if (dirtySections.includes('hours')) dirtyNav.add('Working Hours');
  if (dirtySections.includes('token')) dirtyNav.add('Queue & Tokens');
  for (const field of dirtyRuleFields(base.rules, draft.rules)) dirtyNav.add(RULE_SECTION[field]);

  const { blocked, discard, keepEditing } = useUnsavedChanges({
    dirty,
    message:
      'You have unsaved hospital settings. Discard them?\n\nRules, hours and profile details will stay as they were.',
  });

  const setProfile = <K extends keyof ProfileForm>(k: K, v: ProfileForm[K]) =>
    setEdits((e) => ({ ...e, profile: { ...(e.profile ?? base.profile), [k]: v } }));
  const setRule = <K extends keyof RulesForm>(k: K, v: RulesForm[K]) =>
    setEdits((e) => ({ ...e, rules: { ...(e.rules ?? base.rules), [k]: v } }));
  const setToken = <K extends keyof TokenForm>(k: K, v: TokenForm[K]) =>
    setEdits((e) => ({ ...e, token: { ...(e.token ?? base.token), [k]: v } }));
  const setHours = (next: HoursForm) => setEdits((e) => ({ ...e, hours: next }));

  const resetDraft = (): void => {
    setEdits({});
    setServerErrors(NO_ERRORS);
    setSummary([]);
    setAttempted(false);
  };

  /** One save job per dirty resource; each resolves or rejects with a `Failure`. */
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
    }
  };

  const save = async (): Promise<void> => {
    setAttempted(true);
    setServerErrors(NO_ERRORS);
    setSummary([]);
    if (errorCount > 0) return;
    if (dirtySections.length === 0) return;
    setSaving(true);
    const results = await Promise.allSettled(dirtySections.map(saveJob));
    setSaving(false);

    const saved: SettingsFormSection[] = [];
    let nextErrors: EditorErrors = NO_ERRORS;
    const lines: string[] = [];
    results.forEach((result, i) => {
      const section = dirtySections[i];
      if (section === undefined) return;
      if (result.status === 'fulfilled') {
        saved.push(section);
        return;
      }
      const reason: unknown = result.reason;
      if (isFailure(reason)) {
        const mapped = withServerErrors(nextErrors, section, reason);
        nextErrors = mapped.errors;
        lines.push(...mapped.summary.map((line) => `${SECTION_LABEL[section]} — ${line}`));
      }
      toast(
        `${SECTION_LABEL[section]} not saved — ${describeFailure(reason, 'Something went wrong.')}`,
        'error',
      );
    });

    setEdits((e) => withoutSections(e, saved));
    setServerErrors(nextErrors);
    setSummary(lines);
    if (saved.length === dirtySections.length) {
      setAttempted(false);
      const scheduled = saved.includes('token') && tokenChanges(base.token, draft.token);
      toast(
        scheduled && (scheduled.scope !== undefined || scheduled.reset !== undefined)
          ? 'Settings saved — the token scope or reset change applies from tomorrow'
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
            onError: (error) =>
              toast(describeFailure(error, 'The image could not be uploaded.'), 'error'),
          },
        );
      };
      reader.readAsDataURL(file);
    };

  return (
    <div className="flex items-start gap-5">
      <Card pad={10} className="w-60 flex-none">
        <nav aria-label="Hospital settings sections">
          {SETTINGS_NAV.filter((s) => s.id !== 'Display Screens' || devices.canView).map((s) => {
            const active = sec === s.id;
            const hasEdits = dirtyNav.has(s.id);
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setSec(s.id)}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'text-body flex w-full cursor-pointer items-center gap-3 rounded-md border-none px-3.5 py-3 text-left transition-colors duration-150',
                  active
                    ? 'bg-blue-soft-bg text-text-navy font-semibold'
                    : 'text-text-muted hover:bg-grey-200 bg-transparent font-medium',
                )}
              >
                <Icon name={s.icon} size={19} /> {s.id}
                {hasEdits && (
                  <span
                    className="bg-y-600 ml-auto size-2 flex-none rounded-full"
                    aria-label="unsaved edits"
                  />
                )}
              </button>
            );
          })}
        </nav>
        {dirty && (
          <div className="text-caption text-text-muted border-border-soft mt-2 border-t px-3.5 pt-3">
            Unsaved edits are kept while you move between sections; the dot marks where they are.
            Save or discard them with the bar at the bottom.
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
              The sections marked with a dot hold them.
            </span>
          </Card>
        )}
        <FormErrorSummary messages={summary} title="Some settings could not be saved:" />

        {sec === 'General' && (
          <SettingsGeneralSection
            draft={{ value: draft.profile, set: setProfile, errors: shownProfile }}
            profile={profile}
            mayEdit={mayEdit}
            previews={previews}
            uploading={uploadImage.isPending}
            pickImage={pickImage}
          />
        )}
        {sec === 'Booking & Cancellation' && (
          <SettingsBookingSection
            draft={{ value: draft.rules, set: setRule, errors: shownRules }}
            rules={rules}
            profile={profile}
            mayEdit={mayEdit}
          />
        )}
        {sec === 'Queue & Tokens' && (
          <SettingsQueueSection
            rulesDraft={{ value: draft.rules, set: setRule, errors: shownRules }}
            tokenDraft={{ value: draft.token, set: setToken, errors: shownToken }}
            rules={rules}
            tokenPolicy={tokenPolicy}
            mayEdit={mayEdit}
          />
        )}
        {sec === 'Numbering' && <NumberingPanel mayEdit={mayEdit} />}
        {sec === 'Receipts & Printing' && (
          <SettingsReceiptsSection
            draft={{ value: draft.rules, set: setRule, errors: shownRules }}
            mayEdit={mayEdit}
          />
        )}
        {sec === 'Counters' && <CountersPanel />}
        {sec === 'Display Screens' && devices.canView && <DisplayDevicesPanel access={devices} />}
        {sec === 'Working Hours' && (
          <SettingsHoursSection
            value={draft.hours}
            onChange={setHours}
            errors={shownHours}
            hours={hours}
            rules={rules}
            mayEdit={mayEdit}
          />
        )}
        {sec === 'Bank & Payouts' && <BankAccountsPanel bank={bank} isAdmin={roleId === 'admin'} />}
        {sec === 'Management' && <SettingsManagementSection />}
        {sec === 'Notifications' && <SettingsNotificationsSection />}

        {mayEdit && (
          <UnsavedBar
            dirty={dirty}
            busy={saving}
            onSave={() => void save()}
            onDiscard={resetDraft}
            saveLabel="Save Settings"
            dirtyLabel={`Unsaved changes in ${[...dirtyNav].join(', ')}`}
          />
        )}
      </div>

      <ConfirmModal
        open={blocked}
        title="Leave without saving?"
        body="Your hospital settings edits have not been saved. Rules, hours and profile details will stay as they were."
        confirmLabel="Discard changes"
        danger
        onClose={keepEditing}
        onConfirm={discard}
      />
    </div>
  );
}

/** `errors` with one resource's server field errors added, plus its summary lines. */
function withServerErrors(
  errors: EditorErrors,
  section: SettingsFormSection,
  failure: Failure,
): { readonly errors: EditorErrors; readonly summary: readonly string[] } {
  switch (section) {
    case 'profile': {
      const mapped = mapServerErrors(failure, { fields: PROFILE_SERVER_FIELDS });
      return { errors: { ...errors, profile: mapped.fields }, summary: mapped.summary };
    }
    case 'rules': {
      const mapped = mapServerErrors(failure, { fields: RULES_SERVER_FIELDS });
      return { errors: { ...errors, rules: mapped.fields }, summary: mapped.summary };
    }
    case 'token': {
      const mapped = mapServerErrors(failure, { fields: TOKEN_SERVER_FIELDS });
      return { errors: { ...errors, token: mapped.fields }, summary: mapped.summary };
    }
    case 'hours': {
      const mapped = mapServerErrors(failure, { fields: hoursDayOf });
      const hours: Record<number, string> = {};
      for (const [day, message] of Object.entries(mapped.fields)) {
        if (message) hours[Number(day)] = message;
      }
      return { errors: { ...errors, hours }, summary: mapped.summary };
    }
  }
}
