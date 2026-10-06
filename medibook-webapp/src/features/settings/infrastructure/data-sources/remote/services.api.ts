import { ifMatch } from '@/core/api/headers';
import { hospitalApi } from '@/core/api/http';
import { MAX_PAGE_SIZE, paginatedSchema } from '@/core/api/pagination';

import type {
  CouponInput,
  ServiceInput,
  TaxRateInput,
} from '@/features/settings/domain/entities/services.entities';
import type {
  CouponResponse,
  ServiceResponse,
  TaxRateResponse,
} from '@/features/settings/infrastructure/data-sources/remote/services.response';
import {
  BP_PER_PERCENT,
  couponResponseSchema,
  PAISE_PER_RUPEE,
  serviceResponseSchema,
  taxRateResponseSchema,
} from '@/features/settings/infrastructure/data-sources/remote/services.response';

/**
 * Services, tax rates and coupons (`/api/v1/hospital/…`). Lists are
 * paginated server-side (despite `schema.yml` typing them as arrays); every
 * page is fetched. Codes the backend requires are derived from the name.
 */

export const servicePageSchema = paginatedSchema(serviceResponseSchema);
export const taxRatePageSchema = paginatedSchema(taxRateResponseSchema);
export const couponPageSchema = paginatedSchema(couponResponseSchema);

const CODE_SEPARATOR_PATTERN = /[^a-z0-9]+/g;
const CODE_TRIM_PATTERN = /^-+|-+$/g;

function codeFrom(name: string): string {
  return name.toLowerCase().replace(CODE_SEPARATOR_PATTERN, '-').replace(CODE_TRIM_PATTERN, '');
}

function paise(rupees: number): number {
  return Math.round(rupees * PAISE_PER_RUPEE);
}

async function fetchAllPages<T>(
  fetchPage: (page: number) => Promise<{ results: T[]; has_next: boolean }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let page = 1; ; page += 1) {
    const data = await fetchPage(page);
    rows.push(...data.results);
    if (!data.has_next) return rows;
  }
}

/* ------------------------------------------------------------------ services */

export function getServices(): Promise<ServiceResponse[]> {
  return fetchAllPages(async (page) => {
    const response = await hospitalApi.get('/services', {
      params: { page, page_size: MAX_PAGE_SIZE },
    });
    return servicePageSchema.parse(response.data);
  });
}

function serviceBody(input: ServiceInput) {
  return {
    name: input.name,
    department_id: input.departmentId,
    description: input.description || null,
    duration_min: input.durationMinutes,
    price_paise: paise(input.priceRupees),
    tax_rate_id: input.taxRateId,
    is_active: input.isActive,
  };
}

export async function postService(input: ServiceInput): Promise<ServiceResponse> {
  const response = await hospitalApi.post('/services', {
    ...serviceBody(input),
    code: codeFrom(input.name),
  });
  return serviceResponseSchema.parse(response.data);
}

export async function patchService(
  id: string,
  input: ServiceInput,
  version: number,
): Promise<ServiceResponse> {
  const response = await hospitalApi.patch(
    `/services/${encodeURIComponent(id)}`,
    serviceBody(input),
    {
      headers: ifMatch(version),
    },
  );
  return serviceResponseSchema.parse(response.data);
}

export async function deleteService(id: string): Promise<void> {
  await hospitalApi.delete(`/services/${encodeURIComponent(id)}`);
}

/* ----------------------------------------------------------------- tax rates */

export function getTaxRates(): Promise<TaxRateResponse[]> {
  return fetchAllPages(async (page) => {
    const response = await hospitalApi.get('/tax-rates', {
      params: { page, page_size: MAX_PAGE_SIZE },
    });
    return taxRatePageSchema.parse(response.data);
  });
}

function taxRateBody(input: TaxRateInput) {
  return {
    name: input.name,
    rate_bp: Math.round(input.percent * BP_PER_PERCENT),
    is_inclusive: input.isInclusive,
    applies_to: input.appliesTo,
    is_active: input.isActive,
  };
}

export async function postTaxRate(input: TaxRateInput): Promise<TaxRateResponse> {
  const response = await hospitalApi.post('/tax-rates', {
    ...taxRateBody(input),
    code: codeFrom(input.name),
  });
  return taxRateResponseSchema.parse(response.data);
}

export async function patchTaxRate(
  id: string,
  input: TaxRateInput,
  version: number,
): Promise<TaxRateResponse> {
  const response = await hospitalApi.patch(
    `/tax-rates/${encodeURIComponent(id)}`,
    taxRateBody(input),
    {
      headers: ifMatch(version),
    },
  );
  return taxRateResponseSchema.parse(response.data);
}

export async function deleteTaxRate(id: string): Promise<void> {
  await hospitalApi.delete(`/tax-rates/${encodeURIComponent(id)}`);
}

/* ------------------------------------------------------------------- coupons */

export function getCoupons(): Promise<CouponResponse[]> {
  return fetchAllPages(async (page) => {
    const response = await hospitalApi.get('/coupons', {
      params: { page, page_size: MAX_PAGE_SIZE },
    });
    return couponPageSchema.parse(response.data);
  });
}

/**
 * Only the fields the screen edits; `max_discount_paise`, `per_user_cap` and
 * `applies_to_online_only` are left as they are on PATCH.
 */
function couponBody(input: CouponInput) {
  return {
    code: input.code,
    kind: input.kind,
    // Percent coupons are stored in basis points, flat ones in paise.
    value: input.kind === 'percent' ? Math.round(input.value * BP_PER_PERCENT) : paise(input.value),
    valid_from: input.validFrom,
    valid_to: input.validTo,
    usage_cap: input.usageCap,
    min_order_paise: paise(input.minOrderRupees),
    is_active: input.isActive,
    scopes: [
      ...input.departmentIds.map((id) => ({ department_id: id })),
      ...input.serviceIds.map((id) => ({ service_id: id })),
    ],
  };
}

export async function postCoupon(input: CouponInput): Promise<CouponResponse> {
  const response = await hospitalApi.post('/coupons', couponBody(input));
  return couponResponseSchema.parse(response.data);
}

export async function patchCoupon(
  id: string,
  input: CouponInput,
  version: number,
): Promise<CouponResponse> {
  const response = await hospitalApi.patch(
    `/coupons/${encodeURIComponent(id)}`,
    couponBody(input),
    {
      headers: ifMatch(version),
    },
  );
  return couponResponseSchema.parse(response.data);
}

export async function deleteCoupon(id: string): Promise<void> {
  await hospitalApi.delete(`/coupons/${encodeURIComponent(id)}`);
}
