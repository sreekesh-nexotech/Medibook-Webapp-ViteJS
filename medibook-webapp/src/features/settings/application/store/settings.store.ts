import { create } from 'zustand';

import { toast } from '@/shared/ui/toast/toast.store';

import { recordAudit } from '@/features/audit/application/store/audit.store';

import { DEFAULT_SETTINGS } from './settings.fixtures';
import {
  CANONICAL_TOKEN_SCHEME,
  openDaysInHorizon,
  parseCount,
  parseDurationMinutes,
  slotsPerDay,
} from './settings.rules';
import type {
  HospitalBank,
  HospitalNotify,
  HospitalRules,
  HospitalSettings,
} from './settings.types';

/**
 * Hospital settings store — the saved (draft-free) settings record, persisted
 * to localStorage so Save survives a reload in the demo, exactly like the
 * prototype (`data.jsx` `loadSettings` / `Actions.saveSettings`).
 *
 * ## Reading a rule from another feature (audit 2.6.4)
 *
 * Never parse `settings.rules.*` labels yourself — every rule has a typed
 * selector below, so one interpretation of "15 mins" is shared by the slot
 * grid, the cancellation policy, the token counter and this screen:
 *
 * ```ts
 * const slotMinutes = useSettingsStore(selectSlotLengthMinutes);   // 15
 * const bufferMinutes = useSettingsStore(selectSlotBufferMinutes); // 15
 * ```
 *
 * `selectSlotLengthMinutes` and `selectSlotBufferMinutes` are the two the slot
 * generator needs, together with `selectSchedulingHorizonDays` (how far ahead
 * it may generate at all) and `selectMaxPerSlot` (how many patients one slot
 * time holds); `selectCancellationCutoffHours` + `selectCancellationAllowed`
 * are the cancellation policy; `selectHoldTimeoutMinutes`,
 * `selectAutoNoShowMinutes`, `selectGraceMinutes` and `selectAfterGraceAction`
 * drive the queue. These names are stable — treat them as the contract.
 */

/** The prototype's localStorage key for saved hospital settings. */
const SETTINGS_STORAGE_KEY = 'mb_settings';

/** Logos above this data-URL length are dropped from persistence (quota guard). */
const LOGO_PERSIST_MAX_CHARS = 400000;

/** Shape of a persisted settings blob — any subset of fields may be present. */
type StoredSettings = Partial<Omit<HospitalSettings, 'rules' | 'notify' | 'bank'>> & {
  readonly rules?: Partial<HospitalRules>;
  readonly notify?: Partial<HospitalNotify>;
  readonly bank?: Partial<HospitalBank>;
};

/** Hydrate saved settings, deep-merging over the defaults (design `loadSettings`). */
function loadSettings(): HospitalSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    const s = raw ? (JSON.parse(raw) as StoredSettings | null) : null;
    if (!s) return DEFAULT_SETTINGS;
    return {
      ...DEFAULT_SETTINGS,
      ...s,
      rules: { ...DEFAULT_SETTINGS.rules, ...(s.rules ?? {}) },
      notify: { ...DEFAULT_SETTINGS.notify, ...(s.notify ?? {}) },
      bank: { ...DEFAULT_SETTINGS.bank, ...(s.bank ?? {}) },
    };
  } catch {
    // Unreadable/corrupt persisted blob — fall back to the seed defaults.
    return DEFAULT_SETTINGS;
  }
}

/** Human label per rule key, for the audit trail's "what changed" line. */
const RULE_LABEL: Readonly<Record<keyof HospitalRules, string>> = {
  duration: 'Default consultation duration',
  onlineBooking: 'Online appointment booking',
  horizon: 'Scheduling horizon',
  maxPerSlot: 'Max appointments per slot',
  buffer: 'Buffer between appointments',
  allowCancel: 'Patient cancellation',
  cancelBefore: 'Cancellation cut-off',
  autoNoShow: 'Auto mark No-show after',
  tokenGen: 'Token generation',
  tokenScheme: 'Token scheme',
  showToken: 'Show token number to patient',
  allowHold: 'Allow hold token',
  holdTimeout: 'Hold timeout',
  grace: 'Grace period',
  afterGrace: 'After grace period',
  opFee: 'Default OP consultation fee',
  feeValidity: 'Fee validity (days)',
  applyAllDepts: 'Apply fee to all departments',
};

/** A rule value as the trail should read it. */
function ruleValueCopy(value: string | boolean): string {
  return typeof value === 'boolean' ? (value ? 'On' : 'Off') : value;
}

/** Write one trail entry per changed rule, plus one for the other sections. */
function recordSettingsDiff(before: HospitalSettings, after: HospitalSettings): void {
  for (const key of Object.keys(RULE_LABEL) as (keyof HospitalRules)[]) {
    if (before.rules[key] === after.rules[key]) continue;
    recordAudit({
      action: 'Update',
      entity: 'Settings',
      entityId: `rules.${key}`,
      summary: `${RULE_LABEL[key]} changed`,
      before: ruleValueCopy(before.rules[key]),
      after: ruleValueCopy(after.rules[key]),
      sev: 'Warning',
    });
  }

  const sections: string[] = [];
  const profileKeys: (keyof HospitalSettings)[] = [
    'name',
    'regNo',
    'gstin',
    'phone',
    'email',
    'about',
    'address',
    'lat',
    'lng',
    'logo',
  ];
  if (profileKeys.some((k) => before[k] !== after[k])) sections.push('Profile & location');
  if (
    before.hoursOpen !== after.hoursOpen ||
    before.hoursClose !== after.hoursClose ||
    before.hoursDays.some((v, i) => v !== after.hoursDays[i])
  ) {
    sections.push('Working hours');
  }
  if (
    (Object.keys(before.bank) as (keyof HospitalBank)[]).some(
      (k) => before.bank[k] !== after.bank[k],
    )
  ) {
    sections.push('Bank & payouts');
  }
  if (
    (Object.keys(before.notify) as (keyof HospitalNotify)[]).some(
      (k) => before.notify[k] !== after.notify[k],
    )
  ) {
    sections.push('Notifications');
  }
  if (sections.length > 0) {
    recordAudit({
      action: 'Update',
      entity: 'Settings',
      entityId: 'hospital-settings',
      summary: `Hospital settings updated — ${sections.join(', ')}`,
      before: null,
      after: sections.join(', '),
      sev: sections.includes('Bank & payouts') ? 'Critical' : 'Info',
    });
  }
}

interface SettingsState {
  settings: HospitalSettings;
}

interface SettingsActions {
  /** Save + persist (oversized logos are not persisted); toasts on success. */
  saveSettings: (s: HospitalSettings) => void;
}

export type SettingsStore = SettingsState & SettingsActions;

/** What every selector below reads — the store, or any snapshot of it. */
export interface SettingsSnapshot {
  readonly settings: HospitalSettings;
}

export const useSettingsStore = create<SettingsStore>()((set, get) => ({
  settings: loadSettings(),
  saveSettings: (s) => {
    const before = get().settings;
    set({ settings: s });
    try {
      localStorage.setItem(
        SETTINGS_STORAGE_KEY,
        JSON.stringify({
          ...s,
          logo: s.logo && s.logo.length > LOGO_PERSIST_MAX_CHARS ? null : s.logo,
        }),
      );
    } catch {
      // Persistence is best-effort in the demo (storage full/unavailable).
    }
    recordSettingsDiff(before, s);
    toast('Settings saved', 'success');
  },
}));

/* ======================================================================== *
 * Selectors — the per-rule contract other features consume.
 * Every one is a plain `(state) => value` function, so it can be passed
 * straight to the hook (`useSettingsStore(selectSlotLengthMinutes)`) or
 * applied to `useSettingsStore.getState()` outside React.
 * ======================================================================== */

/** The whole saved record. */
export function selectSettings(s: SettingsSnapshot): HospitalSettings {
  return s.settings;
}

/* ---- appointment / slot rules ---- */

/** Default consultation length in minutes ("15 mins" -> 15). */
export function selectSlotLengthMinutes(s: SettingsSnapshot): number {
  return parseDurationMinutes(s.settings.rules.duration, 15);
}

/** Gap between consecutive appointments in minutes ("15 mins" -> 15). */
export function selectSlotBufferMinutes(s: SettingsSnapshot): number {
  return parseDurationMinutes(s.settings.rules.buffer, 0);
}

/**
 * Concurrent capacity of one slot time ("15 slots" -> 15) — how many patients
 * may hold the same 9:30 am before it reads Full. Not a daily cap.
 */
export function selectMaxPerSlot(s: SettingsSnapshot): number {
  return parseCount(s.settings.rules.maxPerSlot, 1);
}

/**
 * How many calendar days ahead the booking calendar is open ("30 days" -> 30).
 * The slot generator must not emit a slot beyond `todayISO() + this`, and the
 * patient app must not offer one.
 */
export function selectSchedulingHorizonDays(s: SettingsSnapshot): number {
  return parseCount(s.settings.rules.horizon, 30);
}

/** Whether patients may book from the Medibook app at all. */
export function selectOnlineBookingEnabled(s: SettingsSnapshot): boolean {
  return s.settings.rules.onlineBooking;
}

/** Hospital default open/close labels plus the Mon..Sun open flags. */
export interface WorkingHours {
  readonly open: string;
  readonly close: string;
  readonly days: readonly boolean[];
}

export function selectWorkingHours(s: SettingsSnapshot): WorkingHours {
  return {
    open: s.settings.hoursOpen,
    close: s.settings.hoursClose,
    days: s.settings.hoursDays,
  };
}

/**
 * Consultation slots one doctor's day holds under the current rules — the
 * derived number the settings screen shows next to the slot length, and the
 * capacity the slot grid should generate.
 */
export function selectSlotsPerDoctorPerDay(s: SettingsSnapshot): number {
  return slotsPerDay({
    openLabel: s.settings.hoursOpen,
    closeLabel: s.settings.hoursClose,
    slotMinutes: selectSlotLengthMinutes(s),
    bufferMinutes: selectSlotBufferMinutes(s),
  });
}

/**
 * Days inside the scheduling horizon the hospital is actually open, counting
 * `startIso` as day 1 — the bookable-day count the horizon really buys.
 */
export function selectOpenDaysInHorizon(s: SettingsSnapshot, startIso: string): number {
  return openDaysInHorizon(startIso, selectSchedulingHorizonDays(s), s.settings.hoursDays);
}

/* ---- cancellation / no-show policy ---- */

/** Whether the patient app may cancel a booking at all. */
export function selectCancellationAllowed(s: SettingsSnapshot): boolean {
  return s.settings.rules.allowCancel;
}

/** Hours before the appointment after which cancelling forfeits the fee. */
export function selectCancellationCutoffHours(s: SettingsSnapshot): number {
  return parseDurationMinutes(s.settings.rules.cancelBefore, 120) / 60;
}

/** Minutes after the slot before an uncalled patient is marked No-show. */
export function selectAutoNoShowMinutes(s: SettingsSnapshot): number {
  return parseDurationMinutes(s.settings.rules.autoNoShow, 60);
}

/* ---- token queue ---- */

/** Minutes an unpaid online booking holds its slot. */
export function selectHoldTimeoutMinutes(s: SettingsSnapshot): number {
  return parseDurationMinutes(s.settings.rules.holdTimeout, 30);
}

/** Minutes a late patient keeps their queue position. */
export function selectGraceMinutes(s: SettingsSnapshot): number {
  return parseDurationMinutes(s.settings.rules.grace, 30);
}

/** What happens when the grace period expires. */
export function selectAfterGraceAction(s: SettingsSnapshot): string {
  return s.settings.rules.afterGrace;
}

/** `Auto` or `Manual` token issue. */
export function selectTokenGeneration(s: SettingsSnapshot): string {
  return s.settings.rules.tokenGen;
}

/** The configured token scheme label. */
export function selectTokenScheme(s: SettingsSnapshot): string {
  return s.settings.rules.tokenScheme || CANONICAL_TOKEN_SCHEME;
}

/** True when the token scheme is the canonical cross-app `T-001` series. */
export function selectUsesCanonicalTokenScheme(s: SettingsSnapshot): boolean {
  return selectTokenScheme(s) === CANONICAL_TOKEN_SCHEME;
}

export function selectShowTokenToPatient(s: SettingsSnapshot): boolean {
  return s.settings.rules.showToken;
}

export function selectAllowHoldToken(s: SettingsSnapshot): boolean {
  return s.settings.rules.allowHold;
}

/* ---- fees ---- */

/** Default OP consultation fee in whole rupees (the `money()` unit). */
export function selectDefaultOpFee(s: SettingsSnapshot): number {
  return parseCount(s.settings.rules.opFee, 0);
}

/** Days a paid consultation fee covers follow-up visits. */
export function selectFeeValidityDays(s: SettingsSnapshot): number {
  return parseCount(s.settings.rules.feeValidity, 0);
}

/** Whether the default fee overrides every department's own fee. */
export function selectApplyFeeToAllDepartments(s: SettingsSnapshot): boolean {
  return s.settings.rules.applyAllDepts;
}
