import type {
  PlatformSettingsValues,
  TaxRateValues,
} from '@/features/ops-settings/domain/entities/opsSettings.entity';

/** `ConfigSettingsRequest` — every editable field; `PUT` rejects a missing one. */
export interface PlatformSettingsRequest {
  readonly convenience_fee_tax_rate_bp: number;
  readonly platform_gstin: string;
  readonly platform_legal_name: string;
  readonly platform_address_line1: string;
  readonly platform_address_line2: string | null;
  readonly platform_address_line3: string | null;
  readonly platform_city: string;
  readonly platform_state: string;
  readonly platform_pincode: string;
  readonly platform_phone_e164: string | null;
  readonly otp_length: number;
  readonly otp_ttl_seconds: number;
  readonly otp_max_attempts: number;
  readonly login_max_attempts: number;
  readonly login_lockout_seconds: number;
  readonly default_grace_days: number;
  readonly default_trial_days: number;
  readonly quiet_hours_start: string;
  readonly quiet_hours_end: string;
  readonly reminder_offsets_min: readonly number[];
  readonly upload_max_bytes: number;
  readonly dsr_cooling_off_days: number;
  readonly review_moderation_required: boolean;
  readonly session_timeout_min: number;
  readonly min_app_version_android: string | null;
  readonly min_app_version_ios: string | null;
  readonly payout_four_eyes?: boolean;
  readonly max_pending_bookings_per_user?: number;
  readonly max_bookings_per_person_doctor_day?: number;
}

/**
 * The record to `PUT`. A setting the server did not send (`null`) is left
 * out, so an older backend never sees a field it would reject as unknown.
 */
export function toPlatformSettingsRequest(v: PlatformSettingsValues): PlatformSettingsRequest {
  return {
    ...(v.payoutFourEyes !== null ? { payout_four_eyes: v.payoutFourEyes } : {}),
    ...(v.maxPendingBookingsPerUser !== null
      ? { max_pending_bookings_per_user: v.maxPendingBookingsPerUser }
      : {}),
    ...(v.maxBookingsPerPersonDoctorDay !== null
      ? { max_bookings_per_person_doctor_day: v.maxBookingsPerPersonDoctorDay }
      : {}),
    convenience_fee_tax_rate_bp: v.convenienceFeeTaxRateBp,
    platform_gstin: v.gstin,
    platform_legal_name: v.legalName,
    platform_address_line1: v.addressLine1,
    platform_address_line2: v.addressLine2,
    platform_address_line3: v.addressLine3,
    platform_city: v.city,
    platform_state: v.state,
    platform_pincode: v.pincode,
    platform_phone_e164: v.phoneE164,
    otp_length: v.otpLength,
    otp_ttl_seconds: v.otpTtlSeconds,
    otp_max_attempts: v.otpMaxAttempts,
    login_max_attempts: v.loginMaxAttempts,
    login_lockout_seconds: v.loginLockoutSeconds,
    default_grace_days: v.defaultGraceDays,
    default_trial_days: v.defaultTrialDays,
    quiet_hours_start: v.quietHoursStart,
    quiet_hours_end: v.quietHoursEnd,
    reminder_offsets_min: v.reminderOffsetsMin,
    upload_max_bytes: v.uploadMaxBytes,
    dsr_cooling_off_days: v.dsrCoolingOffDays,
    review_moderation_required: v.reviewModerationRequired,
    session_timeout_min: v.sessionTimeoutMin,
    min_app_version_android: v.minAppVersionAndroid,
    min_app_version_ios: v.minAppVersionIos,
  };
}

/** Wire name → entity name, for remapping a 400's field errors. */
export const PLATFORM_SETTINGS_FIELD: Readonly<Record<string, keyof PlatformSettingsValues>> = {
  convenience_fee_tax_rate_bp: 'convenienceFeeTaxRateBp',
  platform_gstin: 'gstin',
  platform_legal_name: 'legalName',
  platform_address_line1: 'addressLine1',
  platform_address_line2: 'addressLine2',
  platform_address_line3: 'addressLine3',
  platform_city: 'city',
  platform_state: 'state',
  platform_pincode: 'pincode',
  platform_phone_e164: 'phoneE164',
  otp_length: 'otpLength',
  otp_ttl_seconds: 'otpTtlSeconds',
  otp_max_attempts: 'otpMaxAttempts',
  login_max_attempts: 'loginMaxAttempts',
  login_lockout_seconds: 'loginLockoutSeconds',
  default_grace_days: 'defaultGraceDays',
  default_trial_days: 'defaultTrialDays',
  quiet_hours_start: 'quietHoursStart',
  quiet_hours_end: 'quietHoursEnd',
  reminder_offsets_min: 'reminderOffsetsMin',
  upload_max_bytes: 'uploadMaxBytes',
  dsr_cooling_off_days: 'dsrCoolingOffDays',
  review_moderation_required: 'reviewModerationRequired',
  session_timeout_min: 'sessionTimeoutMin',
  min_app_version_android: 'minAppVersionAndroid',
  min_app_version_ios: 'minAppVersionIos',
  payout_four_eyes: 'payoutFourEyes',
  max_pending_bookings_per_user: 'maxPendingBookingsPerUser',
  max_bookings_per_person_doctor_day: 'maxBookingsPerPersonDoctorDay',
};

/** `ConfigTaxRateRequest` / `PatchedConfigTaxRateRequest`. */
export interface TaxRateRequest {
  readonly code: string;
  readonly name: string;
  readonly rate_bp: number;
  readonly is_inclusive: boolean;
  readonly applies_to: TaxRateValues['appliesTo'];
  readonly is_active: boolean;
}

export function toTaxRateRequest(v: TaxRateValues): TaxRateRequest {
  return {
    code: v.code,
    name: v.name,
    rate_bp: v.rateBp,
    is_inclusive: v.isInclusive,
    applies_to: v.appliesTo,
    is_active: v.isActive,
  };
}

/** Wire name → entity name, for remapping a 400's field errors. */
export const TAX_RATE_FIELD: Readonly<Record<string, keyof TaxRateValues>> = {
  code: 'code',
  name: 'name',
  rate_bp: 'rateBp',
  is_inclusive: 'isInclusive',
  applies_to: 'appliesTo',
  is_active: 'isActive',
};
