import { z } from 'zod';

/**
 * Public app config (`GET /shared/app-config`, readable before login).
 * Shape from the backend's `platform/services/patient_content.app_config()`;
 * `schema.yml` types it only as `object`.
 */
export interface AppConfig {
  /** Minimum supported mobile app versions (`null` when unset). */
  readonly minVersions: { readonly android: string | null; readonly ios: string | null };
  /** Public feature flags by key. */
  readonly featureFlags: Readonly<Record<string, boolean>>;
  /** Digits in an OTP code. */
  readonly otpLength: number;
  /** Platform support phone in E.164, when configured (Platform Settings). */
  readonly supportPhoneE164: string | null;
  /** Platform support email, once the backend sends one (OBS-06-B). */
  readonly supportEmail: string | null;
  /** Current version number of each legal document, by slug. */
  readonly legalVersions: Readonly<Record<string, number>>;
}

export const appConfigResponseSchema = z.object({
  min_versions: z.object({
    android: z.string().nullable(),
    ios: z.string().nullable(),
  }),
  feature_flags_public: z.record(z.string(), z.boolean()),
  otp_length: z.number().int().positive(),
  support_contacts: z.object({
    phone_e164: z.string().optional(),
    email: z.string().optional(),
  }),
  // `LegalDocument.version` is an integer column (backend `platform/models/legal_document.py`).
  legal_versions: z.record(z.string(), z.number().int()),
});

export type AppConfigResponse = z.infer<typeof appConfigResponseSchema>;

export function toAppConfig(dto: AppConfigResponse): AppConfig {
  return {
    minVersions: dto.min_versions,
    featureFlags: dto.feature_flags_public,
    otpLength: dto.otp_length,
    supportPhoneE164: dto.support_contacts.phone_e164 || null,
    supportEmail: dto.support_contacts.email || null,
    legalVersions: dto.legal_versions,
  };
}
