/**
 * The platform settings form: text-field state, its validation, and the
 * record it saves. Pure functions — the limits are the backend's
 * (`ConfigSettingsSerializer`, B1's D-23 OTP caps, B5's booking caps), so a
 * value the server would refuse is caught before the save.
 */
import type {
  PlatformSettings,
  PlatformSettingsValues,
} from '@/features/ops-settings/domain/entities/opsSettings.entity';
import {
  bpToPercentInput,
  percentInputToBp,
  timeoutLabel,
} from '@/features/ops-settings/presentation/components/opsSettingsFormat';

/** Every editable setting as the form holds it (numbers as typed text). */
export interface SettingsForm {
  readonly legalName: string;
  readonly phone: string;
  readonly gstin: string;
  readonly addressLine1: string;
  readonly addressLine2: string;
  readonly addressLine3: string;
  readonly city: string;
  readonly state: string;
  readonly pincode: string;
  /** Convenience-fee GST as a percentage — the one source pricing reads (BE-18). */
  readonly convenienceFeeGst: string;
  readonly payoutFourEyes: boolean;
  readonly trialDays: string;
  readonly graceDays: string;
  readonly maxPendingBookings: string;
  readonly maxDailyBookings: string;
  /** `HH:MM`. */
  readonly quietStart: string;
  readonly quietEnd: string;
  /** Offsets before the appointment, e.g. `1w, 48h, 24h, 2h`. */
  readonly reminderOffsets: string;
  readonly sessTimeout: string;
  readonly otpLength: string;
  readonly otpTtlSeconds: string;
  readonly otpMaxAttempts: string;
  readonly loginMaxAttempts: string;
  readonly lockoutMinutes: string;
  readonly uploadMaxMb: string;
  readonly dsrCoolingOffDays: string;
  readonly reviewModeration: boolean;
  readonly androidVersion: string;
  readonly iosVersion: string;
}

export type SettingsFormKey = keyof SettingsForm;

/** Per-field inline messages. */
export type SettingsFormErrors = Partial<Record<SettingsFormKey, string | null>>;

/* ------------------------------------------------------------------ limits */

/** `ConfigSettingsSerializer` bounds. */
export const LIMITS = {
  otpLength: [4, 8],
  otpTtlSeconds: [30, 900],
  otpMaxAttempts: [1, 10],
  loginMaxAttempts: [1, 20],
  trialDays: [0, 365],
  graceDays: [0, 90],
  dsrCoolingOffDays: [0, 365],
  maxPendingBookings: [1, 20],
  maxDailyBookings: [1, 10],
} as const;

/** D-23: while the code is this short, validity and attempts are capped (B1, L-07). */
export const SHORT_OTP_LENGTH = 4;
export const SHORT_OTP_MAX_TTL_SECONDS = 180;
export const SHORT_OTP_MAX_ATTEMPTS = 3;

const LOCKOUT_MIN_SECONDS = 60;
const SECONDS_PER_MINUTE = 60;
const BYTES_PER_MB = 1024 * 1024;
const MB_DECIMALS = 1;
const REMINDER_MAX_OFFSETS = 10;
const GSTIN_LENGTH = 15;
const PINCODE_PATTERN = /^[1-9][0-9]{5}$/;
const E164_PATTERN = /^\+[1-9][0-9]{7,14}$/;
const TIME_PATTERN = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;
const APP_VERSION_PATTERN = /^[0-9]+(\.[0-9]+){0,3}$/;
const INTEGER_PATTERN = /^-?[0-9]+$/;

/* ------------------------------------------------------- reminder offsets */

const MINUTES_PER_UNIT: Readonly<Record<string, number>> = {
  m: 1,
  h: 60,
  d: 1440,
  w: 10_080,
};
const MINUTES_PER_WEEK = 10_080;
const MINUTES_PER_HOUR = 60;

/** `[10080, 2880, 1440, 120]` → `"1w, 48h, 24h, 2h"`. */
export function formatReminderOffsets(minutes: readonly number[]): string {
  return minutes
    .map((m) => {
      if (m % MINUTES_PER_WEEK === 0) return `${m / MINUTES_PER_WEEK}w`;
      if (m % MINUTES_PER_HOUR === 0) return `${m / MINUTES_PER_HOUR}h`;
      return `${m}m`;
    })
    .join(', ');
}

/**
 * `"1w, 48h, 2d, 90m"` → minutes, largest first, duplicates removed; `null`
 * when any part is not a whole number with a unit (m, h, d, w).
 */
export function parseReminderOffsets(text: string): number[] | null {
  const parts = text
    .split(/[,\s]+/)
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean);
  if (parts.length === 0) return null;
  const out = new Set<number>();
  for (const part of parts) {
    const match = /^([0-9]+)([mhdw])$/.exec(part);
    if (!match) return null;
    const minutes = Number(match[1]) * (MINUTES_PER_UNIT[match[2]] ?? 0);
    if (minutes < 1) return null;
    out.add(minutes);
  }
  return [...out].sort((a, b) => b - a);
}

/* ------------------------------------------------------------- conversion */

const stripSpaces = (v: string): string => v.replace(/\s/g, '');

/** `"21:00:00"` → `"21:00"`. */
function hhmm(time: string): string {
  return time.slice(0, 5);
}

function bytesToMb(bytes: number): string {
  return String(Number((bytes / BYTES_PER_MB).toFixed(MB_DECIMALS)));
}

function lockoutToMinutes(seconds: number): string {
  return String(Number((seconds / SECONDS_PER_MINUTE).toFixed(2)));
}

export function toSettingsForm(s: PlatformSettings): SettingsForm {
  return {
    legalName: s.legalName,
    phone: s.phoneE164 ?? '',
    gstin: s.gstin,
    addressLine1: s.addressLine1,
    addressLine2: s.addressLine2 ?? '',
    addressLine3: s.addressLine3 ?? '',
    city: s.city,
    state: s.state,
    pincode: s.pincode,
    convenienceFeeGst: bpToPercentInput(s.convenienceFeeTaxRateBp),
    payoutFourEyes: s.payoutFourEyes ?? false,
    trialDays: String(s.defaultTrialDays),
    graceDays: String(s.defaultGraceDays),
    maxPendingBookings:
      s.maxPendingBookingsPerUser === null ? '' : String(s.maxPendingBookingsPerUser),
    maxDailyBookings:
      s.maxBookingsPerPersonDoctorDay === null ? '' : String(s.maxBookingsPerPersonDoctorDay),
    quietStart: hhmm(s.quietHoursStart),
    quietEnd: hhmm(s.quietHoursEnd),
    reminderOffsets: formatReminderOffsets(s.reminderOffsetsMin),
    sessTimeout: timeoutLabel(s.sessionTimeoutMin),
    otpLength: String(s.otpLength),
    otpTtlSeconds: String(s.otpTtlSeconds),
    otpMaxAttempts: String(s.otpMaxAttempts),
    loginMaxAttempts: String(s.loginMaxAttempts),
    lockoutMinutes: lockoutToMinutes(s.loginLockoutSeconds),
    uploadMaxMb: bytesToMb(s.uploadMaxBytes),
    dsrCoolingOffDays: String(s.dsrCoolingOffDays),
    reviewModeration: s.reviewModerationRequired,
    androidVersion: s.minAppVersionAndroid ?? '',
    iosVersion: s.minAppVersionIos ?? '',
  };
}

/* ------------------------------------------------------------- validation */

function intIn(value: string, [lo, hi]: readonly [number, number], label: string): string | null {
  const t = value.trim();
  if (!INTEGER_PATTERN.test(t)) return `Enter ${label} as a whole number.`;
  const n = Number(t);
  return n < lo || n > hi ? `${label} must be between ${lo} and ${hi}.` : null;
}

function required(value: string, message: string): string | null {
  return value.trim() === '' ? message : null;
}

/** Inline messages for every field the server would refuse; empty when the form can be saved. */
export function validateSettingsForm(
  f: SettingsForm,
  s: Pick<PlatformSettings, 'maxPendingBookingsPerUser' | 'maxBookingsPerPersonDoctorDay'>,
): SettingsFormErrors {
  const e: SettingsFormErrors = {};
  e.legalName = required(f.legalName, 'Enter the platform name.');
  const phone = stripSpaces(f.phone);
  e.phone =
    phone === '' || E164_PATTERN.test(phone)
      ? null
      : 'Enter the number in international format, e.g. +918022044000.';
  e.gstin =
    stripSpaces(f.gstin).length === GSTIN_LENGTH
      ? null
      : `GST number must be ${GSTIN_LENGTH} characters.`;
  e.addressLine1 = required(f.addressLine1, 'Enter the first address line.');
  e.city = required(f.city, 'Enter the city.');
  e.state = required(f.state, 'Enter the state.');
  e.pincode = PINCODE_PATTERN.test(f.pincode.trim()) ? null : 'Enter a 6-digit PIN code.';

  const gstBp = percentInputToBp(f.convenienceFeeGst);
  e.convenienceFeeGst =
    gstBp === null || gstBp < 0 || gstBp > 10_000 ? 'Enter a rate between 0 and 100.' : null;

  e.trialDays = intIn(f.trialDays, LIMITS.trialDays, 'Trial days');
  e.graceDays = intIn(f.graceDays, LIMITS.graceDays, 'Grace days');
  if (s.maxPendingBookingsPerUser !== null) {
    e.maxPendingBookings = intIn(f.maxPendingBookings, LIMITS.maxPendingBookings, 'The limit');
  }
  if (s.maxBookingsPerPersonDoctorDay !== null) {
    e.maxDailyBookings = intIn(f.maxDailyBookings, LIMITS.maxDailyBookings, 'The limit');
  }

  e.quietStart = TIME_PATTERN.test(f.quietStart) ? null : 'Enter a time like 21:00.';
  e.quietEnd = TIME_PATTERN.test(f.quietEnd) ? null : 'Enter a time like 08:00.';
  const offsets = parseReminderOffsets(f.reminderOffsets);
  e.reminderOffsets =
    offsets === null
      ? 'List offsets like 1w, 48h, 24h, 2h (m, h, d or w).'
      : offsets.length > REMINDER_MAX_OFFSETS
        ? `At most ${REMINDER_MAX_OFFSETS} reminders.`
        : null;

  e.otpLength = intIn(f.otpLength, LIMITS.otpLength, 'Code length');
  e.otpTtlSeconds = intIn(f.otpTtlSeconds, LIMITS.otpTtlSeconds, 'Validity');
  e.otpMaxAttempts = intIn(f.otpMaxAttempts, LIMITS.otpMaxAttempts, 'Attempts');
  const shortCode = Number(f.otpLength) <= SHORT_OTP_LENGTH;
  if (shortCode && !e.otpTtlSeconds && Number(f.otpTtlSeconds) > SHORT_OTP_MAX_TTL_SECONDS) {
    e.otpTtlSeconds = `With a ${SHORT_OTP_LENGTH}-digit code the validity is at most ${SHORT_OTP_MAX_TTL_SECONDS} seconds (D-23).`;
  }
  if (shortCode && !e.otpMaxAttempts && Number(f.otpMaxAttempts) > SHORT_OTP_MAX_ATTEMPTS) {
    e.otpMaxAttempts = `With a ${SHORT_OTP_LENGTH}-digit code at most ${SHORT_OTP_MAX_ATTEMPTS} attempts per code (D-23).`;
  }
  e.loginMaxAttempts = intIn(f.loginMaxAttempts, LIMITS.loginMaxAttempts, 'Attempts');
  const lockout = Number(f.lockoutMinutes.trim());
  e.lockoutMinutes =
    f.lockoutMinutes.trim() !== '' &&
    Number.isFinite(lockout) &&
    lockout * SECONDS_PER_MINUTE >= LOCKOUT_MIN_SECONDS
      ? null
      : 'Lock out for at least 1 minute.';

  const mb = Number(f.uploadMaxMb.trim());
  e.uploadMaxMb =
    f.uploadMaxMb.trim() !== '' && Number.isFinite(mb) && mb > 0
      ? null
      : 'Enter a size in MB, more than 0.';
  e.dsrCoolingOffDays = intIn(f.dsrCoolingOffDays, LIMITS.dsrCoolingOffDays, 'Cooling-off');

  e.androidVersion =
    f.androidVersion.trim() === '' || APP_VERSION_PATTERN.test(f.androidVersion.trim())
      ? null
      : 'Use a version like 2.4.0, or leave it empty.';
  e.iosVersion =
    f.iosVersion.trim() === '' || APP_VERSION_PATTERN.test(f.iosVersion.trim())
      ? null
      : 'Use a version like 2.4.0, or leave it empty.';

  return Object.fromEntries(Object.entries(e).filter(([, v]) => v)) as SettingsFormErrors;
}

export function hasErrors(errors: SettingsFormErrors): boolean {
  return Object.values(errors).some(Boolean);
}

/* ------------------------------------------------------------------- save */

const orNull = (v: string): string | null => (v.trim() === '' ? null : v.trim());

/**
 * The full record to `PUT`: the loaded one, with each field the user changed
 * (compared with `initial`) converted back to the server's unit. Untouched
 * fields keep the exact stored value, so a display rounding (seconds shown as
 * minutes, bytes as MB) never rewrites a setting nobody edited.
 */
export function toSettingsValues(
  s: PlatformSettings,
  f: SettingsForm,
  initial: SettingsForm,
): PlatformSettingsValues {
  const changed = (k: SettingsFormKey): boolean => f[k] !== initial[k];
  const phone = stripSpaces(f.phone);
  return {
    ...s,
    legalName: f.legalName.trim(),
    phoneE164: phone === '' ? null : phone,
    gstin: stripSpaces(f.gstin).toUpperCase(),
    addressLine1: f.addressLine1.trim(),
    addressLine2: orNull(f.addressLine2),
    addressLine3: orNull(f.addressLine3),
    city: f.city.trim(),
    state: f.state.trim(),
    pincode: f.pincode.trim(),
    convenienceFeeTaxRateBp: changed('convenienceFeeGst')
      ? (percentInputToBp(f.convenienceFeeGst) ?? s.convenienceFeeTaxRateBp)
      : s.convenienceFeeTaxRateBp,
    payoutFourEyes: s.payoutFourEyes === null ? null : f.payoutFourEyes,
    defaultTrialDays: Number(f.trialDays),
    defaultGraceDays: Number(f.graceDays),
    maxPendingBookingsPerUser:
      s.maxPendingBookingsPerUser === null ? null : Number(f.maxPendingBookings),
    maxBookingsPerPersonDoctorDay:
      s.maxBookingsPerPersonDoctorDay === null ? null : Number(f.maxDailyBookings),
    quietHoursStart: changed('quietStart') ? f.quietStart : s.quietHoursStart,
    quietHoursEnd: changed('quietEnd') ? f.quietEnd : s.quietHoursEnd,
    reminderOffsetsMin: changed('reminderOffsets')
      ? (parseReminderOffsets(f.reminderOffsets) ?? s.reminderOffsetsMin)
      : s.reminderOffsetsMin,
    sessionTimeoutMin: Number.parseInt(f.sessTimeout, 10),
    otpLength: Number(f.otpLength),
    otpTtlSeconds: Number(f.otpTtlSeconds),
    otpMaxAttempts: Number(f.otpMaxAttempts),
    loginMaxAttempts: Number(f.loginMaxAttempts),
    loginLockoutSeconds: changed('lockoutMinutes')
      ? Math.round(Number(f.lockoutMinutes) * SECONDS_PER_MINUTE)
      : s.loginLockoutSeconds,
    uploadMaxBytes: changed('uploadMaxMb')
      ? Math.round(Number(f.uploadMaxMb) * BYTES_PER_MB)
      : s.uploadMaxBytes,
    dsrCoolingOffDays: Number(f.dsrCoolingOffDays),
    reviewModerationRequired: f.reviewModeration,
    minAppVersionAndroid: orNull(f.androidVersion),
    minAppVersionIos: orNull(f.iosVersion),
  };
}

/** Which form field shows a server-side error for each settings field. */
export const SERVER_FIELD: Partial<Record<keyof PlatformSettingsValues, SettingsFormKey>> = {
  legalName: 'legalName',
  phoneE164: 'phone',
  gstin: 'gstin',
  addressLine1: 'addressLine1',
  addressLine2: 'addressLine2',
  addressLine3: 'addressLine3',
  city: 'city',
  state: 'state',
  pincode: 'pincode',
  convenienceFeeTaxRateBp: 'convenienceFeeGst',
  payoutFourEyes: 'payoutFourEyes',
  defaultTrialDays: 'trialDays',
  defaultGraceDays: 'graceDays',
  maxPendingBookingsPerUser: 'maxPendingBookings',
  maxBookingsPerPersonDoctorDay: 'maxDailyBookings',
  quietHoursStart: 'quietStart',
  quietHoursEnd: 'quietEnd',
  reminderOffsetsMin: 'reminderOffsets',
  sessionTimeoutMin: 'sessTimeout',
  otpLength: 'otpLength',
  otpTtlSeconds: 'otpTtlSeconds',
  otpMaxAttempts: 'otpMaxAttempts',
  loginMaxAttempts: 'loginMaxAttempts',
  loginLockoutSeconds: 'lockoutMinutes',
  uploadMaxBytes: 'uploadMaxMb',
  dsrCoolingOffDays: 'dsrCoolingOffDays',
  reviewModerationRequired: 'reviewModeration',
  minAppVersionAndroid: 'androidVersion',
  minAppVersionIos: 'iosVersion',
};

/** What each settings section gets from the form. */
export interface SettingsSectionProps {
  readonly f: SettingsForm;
  readonly err: SettingsFormErrors;
  readonly onChange: <K extends SettingsFormKey>(key: K, value: SettingsForm[K]) => void;
}
