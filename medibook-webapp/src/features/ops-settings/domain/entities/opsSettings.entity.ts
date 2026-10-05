/**
 * Platform configuration entities (`/api/v1/platform/settings`,
 * `/feature-flags`, `/tax-rates`). Plain immutable shapes — no logic.
 */

/**
 * Every editable field of the `platform_settings` record. `PUT /settings`
 * replaces the whole record, so a save always sends all of these — the screen
 * edits a few and the rest round-trip unchanged.
 */
export interface PlatformSettingsValues {
  /** Tax on the convenience fee, in basis points (1800 = 18%). */
  readonly convenienceFeeTaxRateBp: number;
  readonly gstin: string;
  readonly legalName: string;
  readonly addressLine1: string;
  readonly addressLine2: string | null;
  readonly addressLine3: string | null;
  readonly city: string;
  readonly state: string;
  readonly pincode: string;
  /** E.164, e.g. `+918022044000`; `null` when not set. */
  readonly phoneE164: string | null;
  readonly otpLength: number;
  readonly otpTtlSeconds: number;
  readonly otpMaxAttempts: number;
  readonly loginMaxAttempts: number;
  readonly loginLockoutSeconds: number;
  readonly defaultGraceDays: number;
  readonly defaultTrialDays: number;
  /** `HH:MM[:SS]`. */
  readonly quietHoursStart: string;
  readonly quietHoursEnd: string;
  readonly reminderOffsetsMin: readonly number[];
  readonly uploadMaxBytes: number;
  readonly dsrCoolingOffDays: number;
  readonly reviewModerationRequired: boolean;
  /** Admin idle sign-out, in minutes. */
  readonly sessionTimeoutMin: number;
  readonly minAppVersionAndroid: string | null;
  readonly minAppVersionIos: string | null;
}

/** The platform settings record as last read from the server. */
export interface PlatformSettings extends PlatformSettingsValues {
  readonly id: number;
  /** Row version — sent back as `If-Match` on save. */
  readonly version: number;
  readonly updatedAt: string;
}

/** A platform feature flag. */
export interface FeatureFlag {
  readonly key: string;
  readonly enabled: boolean;
  readonly description: string;
  /** Exposed to the patient app through public app-config. */
  readonly isPublic: boolean;
  readonly updatedAt: string;
}

/** A page of a platform config list, as far as the screen reads it. */
export interface ConfigList<T> {
  readonly items: readonly T[];
  /** Rows on the server; more than `items.length` when the list was cut off. */
  readonly total: number;
}

/** What a tax rate is charged on. */
export type TaxAppliesTo = 'consultation' | 'service' | 'convenience_fee' | 'all';

/** The editable fields of a platform default tax rate. */
export interface TaxRateValues {
  readonly code: string;
  readonly name: string;
  /** Basis points (1800 = 18%). */
  readonly rateBp: number;
  readonly isInclusive: boolean;
  readonly appliesTo: TaxAppliesTo;
  readonly isActive: boolean;
}

/** A platform default tax rate. */
export interface TaxRate extends TaxRateValues {
  readonly id: string;
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}
