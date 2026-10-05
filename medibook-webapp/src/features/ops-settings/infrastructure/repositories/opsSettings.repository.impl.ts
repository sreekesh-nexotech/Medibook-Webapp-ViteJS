import { attempt } from '@/core/error/attempt';
import type { FieldErrors, Result } from '@/core/error/failure';
import { err } from '@/core/error/failure';

import type { OpsSettingsRepository } from '@/features/ops-settings/domain/repositories/opsSettings.repository';
import * as api from '@/features/ops-settings/infrastructure/data-sources/remote/opsSettings.api';
import {
  PLATFORM_SETTINGS_FIELD,
  TAX_RATE_FIELD,
  toPlatformSettingsRequest,
  toTaxRateRequest,
} from '@/features/ops-settings/infrastructure/data-sources/remote/opsSettings.request';
import {
  toConfigList,
  toFeatureFlag,
  toPlatformSettings,
  toTaxRate,
} from '@/features/ops-settings/infrastructure/data-sources/remote/opsSettings.response';

/** Rename a failure's wire field keys to entity keys, so nothing upward sees DTO names. */
async function withEntityFields<T>(
  pending: Promise<Result<T>>,
  names: Readonly<Record<string, string>>,
): Promise<Result<T>> {
  const result = await pending;
  if (result.ok) return result;
  const fieldErrors: Record<string, FieldErrors[string]> = {};
  for (const [field, messages] of Object.entries(result.failure.fieldErrors)) {
    fieldErrors[names[field] ?? field] = messages;
  }
  return err({ ...result.failure, fieldErrors });
}

export const opsSettingsRepository: OpsSettingsRepository = {
  getSettings: () => attempt(async () => toPlatformSettings(await api.getSettings())),

  saveSettings: (values, version) =>
    withEntityFields(
      attempt(async () =>
        toPlatformSettings(await api.putSettings(toPlatformSettingsRequest(values), version)),
      ),
      PLATFORM_SETTINGS_FIELD,
    ),

  listFeatureFlags: () =>
    attempt(async () => toConfigList(await api.getFeatureFlags(), toFeatureFlag)),

  setFeatureFlagEnabled: (key, enabled) =>
    attempt(async () => toFeatureFlag(await api.patchFeatureFlag(key, enabled))),

  listTaxRates: () => attempt(async () => toConfigList(await api.getTaxRates(), toTaxRate)),

  createTaxRate: (values) =>
    withEntityFields(
      attempt(async () => toTaxRate(await api.postTaxRate(toTaxRateRequest(values)))),
      TAX_RATE_FIELD,
    ),

  updateTaxRate: (id, values, version) =>
    withEntityFields(
      attempt(async () => toTaxRate(await api.patchTaxRate(id, toTaxRateRequest(values), version))),
      TAX_RATE_FIELD,
    ),

  deleteTaxRate: (id, version) =>
    attempt(async () => {
      await api.deleteTaxRate(id, version);
      return null;
    }),
};
