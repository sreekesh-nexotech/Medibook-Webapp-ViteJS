import type { Result } from '@/core/error/failure';

import type {
  ConfigList,
  FeatureFlag,
  PlatformSettings,
  PlatformSettingsValues,
  TaxRate,
  TaxRateValues,
} from '@/features/ops-settings/domain/entities/opsSettings.entity';

/**
 * Platform configuration. Validation failures come back with `fieldErrors`
 * keyed by entity field names (`legalName`, `rateBp`, …), not wire names.
 */
export interface OpsSettingsRepository {
  getSettings(): Promise<Result<PlatformSettings>>;
  /** Full replace; `version` guards against a concurrent edit. */
  saveSettings(values: PlatformSettingsValues, version: number): Promise<Result<PlatformSettings>>;

  listFeatureFlags(): Promise<Result<ConfigList<FeatureFlag>>>;
  setFeatureFlagEnabled(key: string, enabled: boolean): Promise<Result<FeatureFlag>>;

  listTaxRates(): Promise<Result<ConfigList<TaxRate>>>;
  createTaxRate(values: TaxRateValues): Promise<Result<TaxRate>>;
  updateTaxRate(id: string, values: TaxRateValues, version: number): Promise<Result<TaxRate>>;
  /** Soft delete; `version` guards against a concurrent edit. */
  deleteTaxRate(id: string, version: number): Promise<Result<null>>;
}
