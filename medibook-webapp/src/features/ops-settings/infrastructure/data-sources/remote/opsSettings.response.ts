import { z } from 'zod';

import { paginatedSchema } from '@/core/api/pagination';

import type {
  ConfigList,
  FeatureFlag,
  PlatformSettings,
  TaxRate,
} from '@/features/ops-settings/domain/entities/opsSettings.entity';

/** `ConfigSettings` (`schema.yml`) — `GET` / `PUT /platform/settings`. */
export const platformSettingsResponseSchema = z.object({
  id: z.number().int(),
  convenience_fee_tax_rate_bp: z.number().int(),
  platform_gstin: z.string(),
  platform_legal_name: z.string(),
  platform_address_line1: z.string(),
  platform_address_line2: z.string().nullable(),
  platform_address_line3: z.string().nullable(),
  platform_city: z.string(),
  platform_state: z.string(),
  platform_pincode: z.string(),
  platform_phone_e164: z.string().nullable(),
  otp_length: z.number().int(),
  otp_ttl_seconds: z.number().int(),
  otp_max_attempts: z.number().int(),
  login_max_attempts: z.number().int(),
  login_lockout_seconds: z.number().int(),
  default_grace_days: z.number().int(),
  default_trial_days: z.number().int(),
  quiet_hours_start: z.string(),
  quiet_hours_end: z.string(),
  reminder_offsets_min: z.array(z.number().int()),
  upload_max_bytes: z.number().int(),
  dsr_cooling_off_days: z.number().int(),
  review_moderation_required: z.boolean(),
  session_timeout_min: z.number().int(),
  min_app_version_android: z.string().nullable(),
  min_app_version_ios: z.string().nullable(),
  payout_four_eyes: z.boolean().optional(),
  max_pending_bookings_per_user: z.number().int().optional(),
  max_bookings_per_person_doctor_day: z.number().int().optional(),
  version: z.number().int(),
  updated_at: z.string(),
});

export type PlatformSettingsResponse = z.infer<typeof platformSettingsResponseSchema>;

export function toPlatformSettings(dto: PlatformSettingsResponse): PlatformSettings {
  return {
    id: dto.id,
    convenienceFeeTaxRateBp: dto.convenience_fee_tax_rate_bp,
    gstin: dto.platform_gstin,
    legalName: dto.platform_legal_name,
    addressLine1: dto.platform_address_line1,
    addressLine2: dto.platform_address_line2,
    addressLine3: dto.platform_address_line3,
    city: dto.platform_city,
    state: dto.platform_state,
    pincode: dto.platform_pincode,
    phoneE164: dto.platform_phone_e164,
    otpLength: dto.otp_length,
    otpTtlSeconds: dto.otp_ttl_seconds,
    otpMaxAttempts: dto.otp_max_attempts,
    loginMaxAttempts: dto.login_max_attempts,
    loginLockoutSeconds: dto.login_lockout_seconds,
    defaultGraceDays: dto.default_grace_days,
    defaultTrialDays: dto.default_trial_days,
    quietHoursStart: dto.quiet_hours_start,
    quietHoursEnd: dto.quiet_hours_end,
    reminderOffsetsMin: dto.reminder_offsets_min,
    uploadMaxBytes: dto.upload_max_bytes,
    dsrCoolingOffDays: dto.dsr_cooling_off_days,
    reviewModerationRequired: dto.review_moderation_required,
    sessionTimeoutMin: dto.session_timeout_min,
    minAppVersionAndroid: dto.min_app_version_android,
    minAppVersionIos: dto.min_app_version_ios,
    payoutFourEyes: dto.payout_four_eyes ?? null,
    maxPendingBookingsPerUser: dto.max_pending_bookings_per_user ?? null,
    maxBookingsPerPersonDoctorDay: dto.max_bookings_per_person_doctor_day ?? null,
    version: dto.version,
    updatedAt: dto.updated_at,
  };
}

/** `ConfigFeatureFlag` — the list is paginated at runtime (`core/pagination.py`). */
export const featureFlagResponseSchema = z.object({
  key: z.string(),
  enabled: z.boolean(),
  description: z.string(),
  is_public: z.boolean(),
  updated_at: z.string(),
});

export const featureFlagPageResponseSchema = paginatedSchema(featureFlagResponseSchema);

export type FeatureFlagResponse = z.infer<typeof featureFlagResponseSchema>;
export type FeatureFlagPageResponse = z.infer<typeof featureFlagPageResponseSchema>;

export function toFeatureFlag(dto: FeatureFlagResponse): FeatureFlag {
  return {
    key: dto.key,
    enabled: dto.enabled,
    description: dto.description,
    isPublic: dto.is_public,
    updatedAt: dto.updated_at,
  };
}

/** `ConfigTaxRate` — the list is paginated at runtime (`core/pagination.py`). */
export const taxRateResponseSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  rate_bp: z.number().int(),
  is_inclusive: z.boolean(),
  applies_to: z.enum(['consultation', 'service', 'convenience_fee', 'all']),
  is_active: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
  version: z.number().int(),
});

export const taxRatePageResponseSchema = paginatedSchema(taxRateResponseSchema);

export type TaxRateResponse = z.infer<typeof taxRateResponseSchema>;
export type TaxRatePageResponse = z.infer<typeof taxRatePageResponseSchema>;

export function toTaxRate(dto: TaxRateResponse): TaxRate {
  return {
    id: dto.id,
    code: dto.code,
    name: dto.name,
    rateBp: dto.rate_bp,
    isInclusive: dto.is_inclusive,
    appliesTo: dto.applies_to,
    isActive: dto.is_active,
    createdAt: dto.created_at,
    updatedAt: dto.updated_at,
    version: dto.version,
  };
}

/** A validated page as the list the screen reads. */
export function toConfigList<D, T>(
  page: { readonly results: readonly D[]; readonly total: number },
  toEntity: (row: D) => T,
): ConfigList<T> {
  return { items: page.results.map(toEntity), total: page.total };
}
