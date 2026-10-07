import { ifMatch } from '@/core/api/headers';
import { platformApi } from '@/core/api/http';
import { MAX_PAGE_SIZE } from '@/core/api/pagination';

import type { FeatureFlagChanges } from '@/features/ops-settings/domain/entities/opsSettings.entity';
import {
  toFeatureFlagPatchBody,
  type PlatformSettingsRequest,
  type TaxRateRequest,
} from '@/features/ops-settings/infrastructure/data-sources/remote/opsSettings.request';
import type {
  FeatureFlagPageResponse,
  FeatureFlagResponse,
  PlatformSettingsResponse,
  TaxRatePageResponse,
  TaxRateResponse,
} from '@/features/ops-settings/infrastructure/data-sources/remote/opsSettings.response';
import {
  featureFlagPageResponseSchema,
  featureFlagResponseSchema,
  platformSettingsResponseSchema,
  taxRatePageResponseSchema,
  taxRateResponseSchema,
} from '@/features/ops-settings/infrastructure/data-sources/remote/opsSettings.response';

/**
 * Both config lists are short platform catalogues; the screen reads them in
 * one page of the largest size the backend allows.
 */
const CONFIG_LIST_PARAMS = { page_size: MAX_PAGE_SIZE } as const;

export async function getSettings(): Promise<PlatformSettingsResponse> {
  const response = await platformApi.get('/settings');
  return platformSettingsResponseSchema.parse(response.data);
}

export async function putSettings(
  body: PlatformSettingsRequest,
  version: number,
): Promise<PlatformSettingsResponse> {
  const response = await platformApi.put('/settings', body, { headers: ifMatch(version) });
  return platformSettingsResponseSchema.parse(response.data);
}

export async function getFeatureFlags(): Promise<FeatureFlagPageResponse> {
  const response = await platformApi.get('/feature-flags', { params: CONFIG_LIST_PARAMS });
  return featureFlagPageResponseSchema.parse(response.data);
}

/** `PATCH /platform/feature-flags/{key}` (`settings.edit`) — only the fields that change. */
export async function patchFeatureFlag(
  key: string,
  changes: FeatureFlagChanges,
): Promise<FeatureFlagResponse> {
  const response = await platformApi.patch(
    `/feature-flags/${encodeURIComponent(key)}`,
    toFeatureFlagPatchBody(changes),
  );
  return featureFlagResponseSchema.parse(response.data);
}

export async function getTaxRates(): Promise<TaxRatePageResponse> {
  const response = await platformApi.get('/tax-rates', { params: CONFIG_LIST_PARAMS });
  return taxRatePageResponseSchema.parse(response.data);
}

export async function postTaxRate(body: TaxRateRequest): Promise<TaxRateResponse> {
  const response = await platformApi.post('/tax-rates', body);
  return taxRateResponseSchema.parse(response.data);
}

export async function patchTaxRate(
  id: string,
  body: TaxRateRequest,
  version: number,
): Promise<TaxRateResponse> {
  const response = await platformApi.patch(`/tax-rates/${encodeURIComponent(id)}`, body, {
    headers: ifMatch(version),
  });
  return taxRateResponseSchema.parse(response.data);
}

export async function deleteTaxRate(id: string, version: number): Promise<void> {
  await platformApi.delete(`/tax-rates/${encodeURIComponent(id)}`, { headers: ifMatch(version) });
}
