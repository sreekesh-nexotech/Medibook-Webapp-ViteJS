import { type ChangeEvent, type MouseEvent, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { type HospitalStaticView, hospitalPath, isHospitalRole } from '@/app/router/paths';

import { usePermission } from '@/shared/hooks/usePermission';
import { useUnsavedChanges } from '@/shared/hooks/useUnsavedChanges';
import { cn } from '@/shared/lib/cn';
import { money } from '@/shared/lib/format';
import { email as validateEmail, positiveAmount, required } from '@/shared/lib/validate';
import { Card } from '@/shared/ui/Card';
import { ConfirmModal } from '@/shared/ui/ConfirmModal';
import { EmptyState } from '@/shared/ui/EmptyState';
import { Field } from '@/shared/ui/Field';
import { Icon } from '@/shared/ui/Icon';
import type { IconName } from '@/shared/ui/icon-registry';
import { ImageUpload } from '@/shared/ui/ImageUpload';
import { InfoDot } from '@/shared/ui/InfoDot';
import { Select } from '@/shared/ui/Select';
import { TextInput } from '@/shared/ui/TextInput';
import { toast } from '@/shared/ui/toast/toast.store';
import { Toggle } from '@/shared/ui/Toggle';
import { UnsavedBar } from '@/shared/ui/UnsavedBar';

import {
  AFTER_GRACE_OPTIONS,
  AUTO_NO_SHOW_OPTIONS,
  CANCEL_BEFORE_OPTIONS,
  CANONICAL_TOKEN_SCHEME,
  CLOSE_TIME_OPTIONS,
  GRACE_OPTIONS,
  HOLD_TIMEOUT_OPTIONS,
  MAX_PER_SLOT_OPTIONS,
  OPEN_TIME_OPTIONS,
  SLOT_BUFFER_OPTIONS,
  SLOT_LENGTH_OPTIONS,
  TOKEN_GEN_OPTIONS,
  TOKEN_SCHEME_OPTIONS,
  cancellationDeadline,
  durationCopy,
  parseCount,
  parseDurationMinutes,
  shiftTimeLabel,
  slotsPerDay,
  tokenSeriesCopy,
} from '@/features/settings/application/store/settings.rules';
import { useSettingsStore } from '@/features/settings/application/store/settings.store';
import type {
  HospitalNotify,
  HospitalRules,
  HospitalSettings,
} from '@/features/settings/application/store/settings.types';

import { RuleCard } from '../components/RuleCard';
import { RuleRow } from '../components/RuleRow';
import { SettingsHead } from '../components/SettingsHead';

type SettingsSection = 'General' | 'Management' | 'System Rules' | 'Working Hours' | 'Notifications';

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

const PATIENT_COMMS: readonly [keyof HospitalNotify, string, string][] = [
  ['confirm', 'Appointment Confirmation', 'Notify the patient when a booking is confirmed'],
  ['reminder', 'Visit Reminder', 'Remind patients before their appointment'],
];

const ADMIN_ALERTS: readonly [keyof HospitalNotify, string, string][] = [
  ['settleReceived', 'Settlement Received', 'When a Medibook transfer reaches your account'],
  ['settleOverdue', 'Settlement Overdue', 'When an expected settlement is late'],
  ['quotaLow', 'Plan Quota Low', 'When online-appointment credits are running out'],
];

/** The illustrative appointment the cancellation example is written against. */
const EXAMPLE_APPOINTMENT_TIME = '2:00 pm';

/** The illustrative slot the no-show / grace examples are written against. */
const EXAMPLE_SLOT_TIME = '9:30 am';

/** Landline or mobile: 10 or 11 digits once separators are stripped. */
const MIN_PHONE_DIGITS = 10;
const MAX_PHONE_DIGITS = 11;

/** GSTIN is a fixed 15-character identifier. */
const GSTIN_LENGTH = 15;

/** Every field that can carry an inline error on this screen. */
type SettingsErrorKey =
  | 'name'
  | 'regNo'
  | 'gstin'
  | 'phone'
  | 'email'
  | 'address'
  | 'opFee'
  | 'feeValidity'
  | 'bankAccount'
  | 'bankIfsc';

type SettingsErrors = Partial<Record<SettingsErrorKey, string>>;

/**
 * Every rule and profile field validated in one pure pass, so the screen can
 * show inline `Field error=` messages instead of a toast that vanishes
 * (audit 3.5.1).
 */
function validateSettings(d: HospitalSettings): SettingsErrors {
  const errors: SettingsErrors = {};
  const name = required(d.name, 'Hospital name');
  if (name) errors.name = name;
  const regNo = required(d.regNo, 'Registration number');
  if (regNo) errors.regNo = regNo;

  const digits = d.phone.replace(/\D/g, '');
  if (digits.length < MIN_PHONE_DIGITS || digits.length > MAX_PHONE_DIGITS) {
    errors.phone = `Enter a ${MIN_PHONE_DIGITS}- or ${MAX_PHONE_DIGITS}-digit landline or mobile number.`;
  }

  const mail = validateEmail(d.email);
  if (mail) errors.email = mail;

  const address = required(d.address, 'Address');
  if (address) errors.address = address;

  if (d.gstin.trim() !== '' && d.gstin.replace(/\s/g, '').length !== GSTIN_LENGTH) {
    errors.gstin = `GSTIN must be ${GSTIN_LENGTH} characters.`;
  }

  const fee = positiveAmount(d.rules.opFee, 'OP consultation fee');
  if (fee) errors.opFee = fee;
  const validity = positiveAmount(d.rules.feeValidity, 'Fee validity');
  if (validity) errors.feeValidity = validity;

  if (d.bank.account.trim() !== '' && !/^\d{9,18}$/.test(d.bank.account.replace(/\s/g, ''))) {
    errors.bankAccount = 'Account number must be 9–18 digits.';
  }
  if (d.bank.ifsc.trim() !== '' && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(d.bank.ifsc.toUpperCase())) {
    errors.bankIfsc = 'IFSC looks like HDFC0001234 — 4 letters, a zero, then 6 characters.';
  }
  return errors;
}

/**
 * Hospital Settings — the screen audit 3.7.1 calls "the clearest case:
 * switching section tabs drops the edits without a word", and audit 2.6.4
 * calls unvalidatable because "no screen behaves differently after [the
 * rules] are changed".
 *
 * Both are fixed here:
 *  - one draft for the whole screen, a sticky `UnsavedBar`, `useUnsavedChanges`
 *    blocking route navigation, and the synchronous `confirmDiscard()` on the
 *    section tabs React Router never sees;
 *  - every rule shows the consequence derived from its own value (slots per
 *    day, the cancellation deadline for a 2 pm appointment, the token series),
 *    so changing a rule visibly changes something on the spot. The same
 *    derivations are exported as selectors for the slot, queue and
 *    cancellation features.
 */
export function HospitalSettingsScreen() {
  const navigate = useNavigate();
  const { role: roleParam } = useParams();
  const role = isHospitalRole(roleParam) ? roleParam : 'admin';

  const saved = useSettingsStore((s) => s.settings);
  const saveSettings = useSettingsStore((s) => s.saveSettings);
  const { can } = usePermission();
  const mayEdit = can('Hospital Settings.edit');

  const [sec, setSec] = useState<SettingsSection>('General');
  const [draft, setDraft] = useState<HospitalSettings>(saved);
  const [gallery, setGallery] = useState<readonly (string | null)[]>([null, null]);
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);

  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const errors = validateSettings(draft);
  const errorCount = Object.keys(errors).length;
  const errorFor = (key: SettingsErrorKey): string | undefined =>
    attempted ? errors[key] : undefined;

  const { blocked, discard, keepEditing, confirmDiscard } = useUnsavedChanges({
    dirty,
    message:
      'You have unsaved hospital settings. Discard them?\n\nSlot length, cut-offs, fees and token rules will stay as they were.',
  });

  const set = <K extends keyof HospitalSettings>(k: K, v: HospitalSettings[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));
  const setRule = <K extends keyof HospitalRules>(k: K, v: HospitalRules[K]) =>
    setDraft((d) => ({ ...d, rules: { ...d.rules, [k]: v } }));
  const setNote = <K extends keyof HospitalNotify>(k: K, v: HospitalNotify[K]) =>
    setDraft((d) => ({ ...d, notify: { ...d.notify, [k]: v } }));
  const setBank = (k: keyof HospitalSettings['bank'], v: string) =>
    setDraft((d) => ({ ...d, bank: { ...d.bank, [k]: v } }));

  /** Section tabs are in-page: React Router never sees them (audit 3.7.1). */
  const switchSection = (next: SettingsSection): void => {
    if (next === sec) return;
    if (!confirmDiscard()) return;
    setDraft(saved);
    setAttempted(false);
    setSec(next);
  };

  const onNavigate = (view: HospitalStaticView): void => {
    navigate(hospitalPath(role, view));
  };

  const save = (): void => {
    setAttempted(true);
    if (errorCount > 0) return;
    setSaving(true);
    saveSettings(draft);
    setSaving(false);
  };

  const discardEdits = (): void => {
    setDraft(saved);
    setAttempted(false);
  };

  const pick = (cb: (url: string) => void) => (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      if (typeof r.result === 'string') cb(r.result);
    };
    r.readAsDataURL(f);
  };

  const sel = (
    value: string,
    options: readonly string[],
    onChange: (v: string) => void,
    ariaLabel: string,
  ) => (
    <div className="w-32.5">
      <Select
        value={value}
        options={options}
        onChange={onChange}
        height={40}
        aria-label={ariaLabel}
        disabled={!mayEdit}
      />
    </div>
  );

  /* ---- derived consequences of the draft's own rules (audit 2.6.4) ---- */

  const slotMinutes = parseDurationMinutes(draft.rules.duration, 15);
  const bufferMinutes = parseDurationMinutes(draft.rules.buffer, 0);
  const perDoctorSlots = slotsPerDay({
    openLabel: draft.hoursOpen,
    closeLabel: draft.hoursClose,
    slotMinutes,
    bufferMinutes,
  });
  const maxPerSlot = parseCount(draft.rules.maxPerSlot, 1);
  const cancelHours = parseDurationMinutes(draft.rules.cancelBefore, 120) / 60;
  const cancelDeadline = cancellationDeadline(EXAMPLE_APPOINTMENT_TIME, cancelHours);
  const autoNoShowMinutes = parseDurationMinutes(draft.rules.autoNoShow, 60);
  const graceMinutes = parseDurationMinutes(draft.rules.grace, 30);
  const holdMinutes = parseDurationMinutes(draft.rules.holdTimeout, 30);
  const openDays = draft.hoursDays.filter(Boolean).length;
  const feeDays = parseCount(draft.rules.feeValidity, 0);

  if (!can('Hospital Settings.view')) {
    return (
      <Card>
        <EmptyState
          icon="lock"
          title="You do not have access to hospital settings"
          message="Hospital settings are limited to roles with the Hospital Settings view permission. Ask an administrator to grant it under Users & Roles."
        />
      </Card>
    );
  }

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
                    src={draft.logo || '/assets/apollo-logo.png'}
                    className={cn('object-cover', draft.logo ? 'h-full w-full' : 'size-12')}
                    alt=""
                  />
                </div>
                <div>
                  <label className="inline-block">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={!mayEdit}
                      onChange={pick((url) => set('logo', url))}
                    />
                    <span className="text-body border-text-navy text-text-navy inline-flex cursor-pointer items-center gap-2 rounded-lg border bg-white px-3.5 py-2 font-medium">
                      <Icon name="upload" size={16} /> Change Logo
                    </span>
                  </label>
                  <div className="text-caption text-text-muted mt-2">PNG or JPG, up to 1MB</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-x-8 gap-y-5.5">
                <Field label="Hospital Name" required error={errorFor('name')}>
                  <TextInput
                    value={draft.name}
                    onChange={(v) => set('name', v)}
                    disabled={!mayEdit}
                  />
                </Field>
                <Field label="Registration No." required error={errorFor('regNo')}>
                  <TextInput
                    value={draft.regNo}
                    onChange={(v) => set('regNo', v)}
                    disabled={!mayEdit}
                  />
                </Field>
                <Field
                  label="GSTIN"
                  error={errorFor('gstin')}
                  hint="Printed on every receipt and invoice."
                >
                  <TextInput
                    value={draft.gstin || ''}
                    onChange={(v) => set('gstin', v.toUpperCase())}
                    disabled={!mayEdit}
                  />
                </Field>
                <Field label="Phone" required error={errorFor('phone')}>
                  <TextInput
                    value={draft.phone}
                    onChange={(v) => set('phone', v)}
                    inputMode="tel"
                    autoComplete="tel"
                    disabled={!mayEdit}
                  />
                </Field>
                <Field label="Email" required error={errorFor('email')}>
                  <TextInput
                    value={draft.email}
                    onChange={(v) => set('email', v)}
                    inputMode="email"
                    autoComplete="email"
                    disabled={!mayEdit}
                  />
                </Field>
                <Field label="About" className="col-span-full">
                  <textarea
                    value={draft.about}
                    onChange={(e) => set('about', e.target.value)}
                    disabled={!mayEdit}
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
                {[0, 1].map((i) => {
                  const src = gallery[i];
                  return (
                    <label key={i} className="block cursor-pointer">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={!mayEdit}
                        onChange={pick((url) =>
                          setGallery((g) => g.map((x, j) => (j === i ? url : x))),
                        )}
                      />
                      {src ? (
                        <img
                          src={src}
                          className="border-border h-32.5 w-full rounded-lg border object-cover"
                          alt=""
                        />
                      ) : (
                        <ImageUpload
                          label={i === 0 ? 'Cover photo' : 'Reception'}
                          hint={i === 0 ? '1280×720' : undefined}
                          h={130}
                        />
                      )}
                    </label>
                  );
                })}
                <label className="block cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={!mayEdit}
                    onChange={pick(() => toast('Photo added', 'success'))}
                  />
                  <ImageUpload label="Add photo" h={130} icon="plus" />
                </label>
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
                      value={draft.address}
                      onChange={(v) => set('address', v)}
                      disabled={!mayEdit}
                    />
                  </Field>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Latitude">
                      <TextInput
                        value={draft.lat}
                        onChange={(v) => set('lat', v)}
                        inputMode="decimal"
                        disabled={!mayEdit}
                      />
                    </Field>
                    <Field label="Longitude">
                      <TextInput
                        value={draft.lng}
                        onChange={(v) => set('lng', v)}
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
                      Math.min(100, Math.round(((e.clientX - r.left) / r.width) * 100)),
                    );
                    const y = Math.max(
                      0,
                      Math.min(100, Math.round(((e.clientY - r.top) / r.height) * 100)),
                    );
                    setDraft((d) => ({
                      ...d,
                      pin: { x, y },
                      lat: (12.84 + (1 - y / 100) * 0.14).toFixed(4),
                      lng: (77.54 + (x / 100) * 0.14).toFixed(4),
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
                    style={{ top: `${draft.pin.y}%`, left: `${draft.pin.x}%` }}
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
              <div className="grid grid-cols-2 gap-x-8 gap-y-5.5">
                <Field label="Account Holder Name">
                  <TextInput
                    value={draft.bank.accountName || ''}
                    onChange={(v) => setBank('accountName', v)}
                    disabled={!mayEdit}
                  />
                </Field>
                <Field label="Bank">
                  <TextInput
                    value={draft.bank.bank || ''}
                    onChange={(v) => setBank('bank', v)}
                    disabled={!mayEdit}
                  />
                </Field>
                <Field label="Account Number" error={errorFor('bankAccount')}>
                  <TextInput
                    value={draft.bank.account || ''}
                    onChange={(v) => setBank('account', v)}
                    inputMode="numeric"
                    disabled={!mayEdit}
                  />
                </Field>
                <Field label="IFSC Code" error={errorFor('bankIfsc')}>
                  <TextInput
                    value={draft.bank.ifsc || ''}
                    onChange={(v) => setBank('ifsc', v.toUpperCase())}
                    disabled={!mayEdit}
                  />
                </Field>
                <Field label="Settlement UPI ID (optional)">
                  <TextInput
                    value={draft.bank.upi || ''}
                    onChange={(v) => setBank('upi', v)}
                    disabled={!mayEdit}
                  />
                </Field>
              </div>
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
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <span className="text-body text-text-muted">Default open</span>
              <div className="w-30">
                <Select
                  value={draft.hoursOpen}
                  options={OPEN_TIME_OPTIONS}
                  onChange={(v) => set('hoursOpen', v)}
                  height={40}
                  aria-label="Default opening time"
                  disabled={!mayEdit}
                />
              </div>
              <span className="text-body text-text-muted">to</span>
              <div className="w-30">
                <Select
                  value={draft.hoursClose}
                  options={CLOSE_TIME_OPTIONS}
                  onChange={(v) => set('hoursClose', v)}
                  height={40}
                  aria-label="Default closing time"
                  disabled={!mayEdit}
                />
              </div>
              <span className="text-caption text-text-muted">
                {openDays} open {openDays === 1 ? 'day' : 'days'} a week ·{' '}
                {durationCopy(slotMinutes + bufferMinutes)} per appointment ·{' '}
                <span className="text-text-strong font-medium">
                  ≈ {perDoctorSlots} slots per doctor per day
                </span>
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
                    value={draft.hoursDays[i]}
                    onChange={(v) =>
                      set(
                        'hoursDays',
                        draft.hoursDays.map((x, j) => (j === i ? v : x)),
                      )
                    }
                    label={`${d} open`}
                    disabled={!mayEdit}
                  />
                  <span className="flex-1"></span>
                  <span
                    className={cn(
                      'text-body',
                      draft.hoursDays[i] ? 'text-text-body' : 'text-text-muted',
                    )}
                  >
                    {draft.hoursDays[i]
                      ? `${draft.hoursOpen} — ${draft.hoursClose} · ≈ ${perDoctorSlots} slots`
                      : 'Closed'}
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
                  hint={`≈ ${perDoctorSlots} slots per doctor per day (${draft.hoursOpen}–${draft.hoursClose})`}
                >
                  {sel(
                    draft.rules.duration,
                    SLOT_LENGTH_OPTIONS,
                    (v) => setRule('duration', v),
                    'Default consultation duration',
                  )}
                </RuleRow>
                <RuleRow
                  label="Online appointment booking"
                  hint={
                    draft.rules.onlineBooking
                      ? 'Patients can book from the Medibook app'
                      : 'App booking is off — walk-in and desk bookings only'
                  }
                >
                  <Toggle
                    value={draft.rules.onlineBooking}
                    onChange={(v) => setRule('onlineBooking', v)}
                    label="Allow online appointment booking"
                    disabled={!mayEdit}
                  />
                </RuleRow>
                <RuleRow
                  label="Max appointments per slot"
                  hint={`Up to ${perDoctorSlots * maxPerSlot} appointments a day per doctor at this slot length`}
                >
                  {sel(
                    draft.rules.maxPerSlot,
                    MAX_PER_SLOT_OPTIONS,
                    (v) => setRule('maxPerSlot', v),
                    'Maximum appointments per slot',
                  )}
                </RuleRow>
                <RuleRow
                  label="Buffer time between appointments"
                  hint={
                    bufferMinutes === 0
                      ? 'Appointments run back to back'
                      : `Each appointment consumes ${durationCopy(slotMinutes + bufferMinutes)} of the doctor's day`
                  }
                  last
                >
                  {sel(
                    draft.rules.buffer,
                    SLOT_BUFFER_OPTIONS,
                    (v) => setRule('buffer', v),
                    'Buffer time between appointments',
                  )}
                </RuleRow>
              </RuleCard>

              <RuleCard title="Cancellation & No-show Rules">
                <RuleRow
                  label="Allow patient cancellation"
                  hint={
                    draft.rules.allowCancel
                      ? 'Patients can cancel from the app within the cut-off'
                      : 'Only the desk can cancel a booking'
                  }
                >
                  <Toggle
                    value={draft.rules.allowCancel}
                    onChange={(v) => setRule('allowCancel', v)}
                    label="Allow patients to cancel their own booking"
                    disabled={!mayEdit}
                  />
                </RuleRow>
                <RuleRow
                  label="Cancellation allowed before"
                  hint={
                    draft.rules.allowCancel
                      ? `Cancelling after ${cancelDeadline} for a ${EXAMPLE_APPOINTMENT_TIME} appointment forfeits the fee`
                      : 'No effect while patient cancellation is off'
                  }
                >
                  {sel(
                    draft.rules.cancelBefore,
                    CANCEL_BEFORE_OPTIONS,
                    (v) => setRule('cancelBefore', v),
                    'Cancellation cut-off',
                  )}
                </RuleRow>
                <RuleRow
                  label="Auto mark No-show after"
                  hint={`A ${EXAMPLE_SLOT_TIME} patient not called by ${shiftTimeLabel(
                    EXAMPLE_SLOT_TIME,
                    autoNoShowMinutes,
                  )} is marked No-show`}
                  last
                >
                  {sel(
                    draft.rules.autoNoShow,
                    AUTO_NO_SHOW_OPTIONS,
                    (v) => setRule('autoNoShow', v),
                    'Auto mark No-show after',
                  )}
                </RuleRow>
              </RuleCard>

              <RuleCard title="Token Queue Behaviour" hint="Applies to all departments">
                <RuleRow
                  label="Token scheme"
                  hint={`Tokens issue as ${tokenSeriesCopy(draft.rules.tokenScheme)}${
                    draft.rules.tokenScheme === CANONICAL_TOKEN_SCHEME
                      ? ' — the format the patient app shows'
                      : ' — the patient app expects the hospital-wide T-001 series'
                  }`}
                >
                  <div className="w-45">
                    <Select
                      value={draft.rules.tokenScheme}
                      options={TOKEN_SCHEME_OPTIONS}
                      onChange={(v) => setRule('tokenScheme', v)}
                      height={40}
                      aria-label="Token scheme"
                      disabled={!mayEdit}
                    />
                  </div>
                </RuleRow>
                <RuleRow
                  label="Token generation"
                  hint={
                    draft.rules.tokenGen === 'Auto'
                      ? 'A token is issued the moment payment is recorded'
                      : 'The desk issues each token by hand'
                  }
                >
                  {sel(
                    draft.rules.tokenGen,
                    TOKEN_GEN_OPTIONS,
                    (v) => setRule('tokenGen', v),
                    'Token generation',
                  )}
                </RuleRow>
                <RuleRow
                  label="Show token number to patient"
                  hint={
                    draft.rules.showToken
                      ? 'The app shows the token and queue position'
                      : 'The app shows only the appointment time'
                  }
                >
                  <Toggle
                    value={draft.rules.showToken}
                    onChange={(v) => setRule('showToken', v)}
                    label="Show the token number to the patient"
                    disabled={!mayEdit}
                  />
                </RuleRow>
                <RuleRow
                  label="Allow hold token"
                  hint={
                    draft.rules.allowHold
                      ? `An unpaid online booking holds its slot for ${durationCopy(holdMinutes)}`
                      : 'Slots are only held once payment is recorded'
                  }
                >
                  <Toggle
                    value={draft.rules.allowHold}
                    onChange={(v) => setRule('allowHold', v)}
                    label="Allow a token to be held"
                    disabled={!mayEdit}
                  />
                </RuleRow>
                <RuleRow
                  label="Hold timeout"
                  hint={`Unpaid holds are released after ${durationCopy(holdMinutes)}, freeing the slot`}
                >
                  {sel(
                    draft.rules.holdTimeout,
                    HOLD_TIMEOUT_OPTIONS,
                    (v) => setRule('holdTimeout', v),
                    'Hold timeout',
                  )}
                </RuleRow>
                <RuleRow
                  label="Grace period"
                  hint={`A ${EXAMPLE_SLOT_TIME} patient keeps their place until ${shiftTimeLabel(
                    EXAMPLE_SLOT_TIME,
                    graceMinutes,
                  )}`}
                >
                  {sel(
                    draft.rules.grace,
                    GRACE_OPTIONS,
                    (v) => setRule('grace', v),
                    'Grace period',
                  )}
                </RuleRow>
                <RuleRow
                  label="After grace"
                  hint={
                    draft.rules.afterGrace === 'Auto Mark No-show'
                      ? 'The token is marked No-show and the queue moves on'
                      : 'The patient stays in the queue until the desk acts'
                  }
                  last
                >
                  {sel(
                    draft.rules.afterGrace,
                    AFTER_GRACE_OPTIONS,
                    (v) => setRule('afterGrace', v),
                    'After the grace period',
                  )}
                </RuleRow>
              </RuleCard>

              <RuleCard
                title="Consultation Fees"
                hint="Default OP fee for doctors without a custom fee"
              >
                <RuleRow
                  label="OP Consultation Fee"
                  hint={`${money(parseCount(draft.rules.opFee, 0))} charged when a doctor has no fee of their own`}
                >
                  <div className="w-32.5">
                    <Field label="" htmlFor="op-fee" error={errorFor('opFee')}>
                      <TextInput
                        id="op-fee"
                        value={'₹ ' + draft.rules.opFee}
                        onChange={(v) => setRule('opFee', v.replace(/[^0-9]/g, ''))}
                        height={40}
                        inputMode="numeric"
                        aria-label="OP consultation fee in rupees"
                        disabled={!mayEdit}
                      />
                    </Field>
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
                <RuleRow
                  label="Apply to all departments"
                  hint={
                    draft.rules.applyAllDepts
                      ? "This fee overrides every department's own base fee"
                      : 'Each department keeps its own base fee'
                  }
                  last
                >
                  <Toggle
                    value={draft.rules.applyAllDepts}
                    onChange={(v) => setRule('applyAllDepts', v)}
                    label="Apply the default fee to all departments"
                    disabled={!mayEdit}
                  />
                </RuleRow>
              </RuleCard>
            </div>
            <Card pad={16} className="flex items-start gap-2.5">
              <Icon name="info" size={16} className="text-blue mt-0.5 flex-none" />
              <span className="text-body text-text-body">
                With these rules a doctor working {draft.hoursOpen}–{draft.hoursClose} has{' '}
                <span className="font-semibold">{perDoctorSlots} slots</span> of{' '}
                {durationCopy(slotMinutes)} (plus {durationCopy(bufferMinutes)} buffer), up to{' '}
                <span className="font-semibold">{perDoctorSlots * maxPerSlot} appointments</span> a
                day. Slots & Availability generates exactly this, minus anything on the holiday
                calendar.
              </span>
            </Card>
          </>
        )}

        {sec === 'Notifications' && (
          <>
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
                  <Toggle
                    value={draft.notify[k]}
                    onChange={(v) => setNote(k, v)}
                    label={t}
                    disabled={!mayEdit}
                  />
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
                  <Toggle
                    value={draft.notify[k]}
                    onChange={(v) => setNote(k, v)}
                    label={t}
                    disabled={!mayEdit}
                  />
                </div>
              ))}
            </Card>
          </>
        )}

        {mayEdit && (
          <UnsavedBar
            dirty={dirty}
            busy={saving}
            onSave={save}
            onDiscard={discardEdits}
            saveLabel="Save Settings"
            dirtyLabel={`Unsaved changes in ${sec}`}
          />
        )}
      </div>

      <ConfirmModal
        open={blocked}
        title="Leave without saving?"
        body="Your hospital settings edits have not been saved. Slot length, cut-offs, fees and token rules will stay as they were."
        confirmLabel="Discard changes"
        danger
        onClose={keepEditing}
        onConfirm={discard}
      />
    </div>
  );
}
