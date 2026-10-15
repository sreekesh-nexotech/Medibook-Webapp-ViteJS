import { ifMatch } from '@/core/api/headers';
import { hospitalApi } from '@/core/api/http';
import { MAX_PAGE_SIZE, paginatedSchema } from '@/core/api/pagination';

import type {
  CouponInput,
  DoctorServiceLinkInput,
  ServiceInput,
  TaxRateInput,
} from '@/features/settings/domain/entities/services.entities';
import type {
  CouponRedemptionResponse,
  CouponResponse,
  DoctorServiceResponse,
  ServiceResponse,
  TaxRateResponse,
} from '@/features/settings/infrastructure/data-sources/remote/services.response';
import {
  BP_PER_PERCENT,
  couponRedemptionResponseSchema,
  couponResponseSchema,
  doctorServiceResponseSchema,
  PAISE_PER_RUPEE,
  serviceResponseSchema,
  taxRateResponseSchema,
} from '@/features/settings/infrastructure/data-sources/remote/services.response';

/**
 * Services, tax rates and coupons (`/api/v1/hospital/…`). Lists are
 * paginated server-side (despite `schema.yml` typing them as arrays); every
 * page is fetched. A `code` is sent only when the admin typed one — the
 * server makes a unique one from the name otherwise (UAT-49, BE-33).
 */

export const servicePageSchema = paginatedSchema(serviceResponseSchema);
export const taxRatePageSchema = paginatedSchema(taxRateResponseSchema);
export const couponPageSchema = paginatedSchema(couponResponseSchema);
export const doctorServicePageSchema = paginatedSchema(doctorServiceResponseSchema);
export const couponRedemptionPageSchema = paginatedSchema(couponRedemptionResponseSchema);

/** `{code}` when the admin typed one; nothing otherwise (blank on PATCH = unchanged). */
function typedCode(code: string | undefined): { code?: string } {
  const value = code?.trim() ?? '';
  return value === '' ? {} : { code: value };
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
    // Omitted = unchanged; re-sending a since-deactivated rate is refused.
    ...(input.taxRateId === undefined ? {} : { tax_rate_id: input.taxRateId }),
    requires_doctor: input.requiresDoctor,
    is_active: input.isActive,
  };
}

export async function postService(input: ServiceInput): Promise<ServiceResponse> {
  const response = await hospitalApi.post('/services', {
    ...serviceBody(input),
    ...typedCode(input.code),
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
    { ...serviceBody(input), ...typedCode(input.code) },
    {
      headers: ifMatch(version),
    },
  );
  return serviceResponseSchema.parse(response.data);
}

/** Only `is_active` — the rest of the service is left exactly as stored (07·S-F7). */
export async function patchServiceActive(
  id: string,
  isActive: boolean,
  version: number,
): Promise<ServiceResponse> {
  const response = await hospitalApi.patch(
    `/services/${encodeURIComponent(id)}`,
    { is_active: isActive },
    { headers: ifMatch(version) },
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
    ...typedCode(input.code),
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
    { ...taxRateBody(input), ...typedCode(input.code) },
    {
      headers: ifMatch(version),
    },
  );
  return taxRateResponseSchema.parse(response.data);
}

/** Only `is_active` (409 `TAX_RATE_IN_USE` when switching off a rate services use). */
export async function patchTaxRateActive(
  id: string,
  isActive: boolean,
  version: number,
): Promise<TaxRateResponse> {
  const response = await hospitalApi.patch(
    `/tax-rates/${encodeURIComponent(id)}`,
    { is_active: isActive },
    { headers: ifMatch(version) },
  );
  return taxRateResponseSchema.parse(response.data);
}

/** 409 `TAX_RATE_IN_USE` while services bill with it (BE-10). */
export async function deleteTaxRate(id: string, version: number): Promise<void> {
  await hospitalApi.delete(`/tax-rates/${encodeURIComponent(id)}`, { headers: ifMatch(version) });
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

function couponBody(input: CouponInput) {
  return {
    code: input.code,
    kind: input.kind,
    // Percent coupons are stored in basis points, flat ones in paise.
    value: input.kind === 'percent' ? Math.round(input.value * BP_PER_PERCENT) : paise(input.value),
    valid_from: input.validFrom,
    valid_to: input.validTo,
    usage_cap: input.usageCap,
    per_user_cap: input.perUserCap,
    max_discount_paise:
      input.kind === 'percent' && input.maxDiscountRupees !== null
        ? paise(input.maxDiscountRupees)
        : null,
    min_order_paise: paise(input.minOrderRupees),
    is_active: input.isActive,
    // Department scopes only (decision 7, BE-25); service scopes are refused.
    scopes: input.departmentIds.map((id) => ({ department_id: id })),
  };
}

export async function postCoupon(input: CouponInput): Promise<CouponResponse> {
  // No desk flow takes a coupon (decision 7): every coupon is an app coupon.
  const response = await hospitalApi.post('/coupons', {
    ...couponBody(input),
    applies_to_online_only: true,
  });
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

/** Pause / resume: only `is_active`, so stale scopes cannot block it (07·S-F7). */
export async function patchCouponActive(
  id: string,
  isActive: boolean,
  version: number,
): Promise<CouponResponse> {
  const response = await hospitalApi.patch(
    `/coupons/${encodeURIComponent(id)}`,
    { is_active: isActive },
    { headers: ifMatch(version) },
  );
  return couponResponseSchema.parse(response.data);
}

export async function deleteCoupon(id: string, version: number): Promise<void> {
  await hospitalApi.delete(`/coupons/${encodeURIComponent(id)}`, { headers: ifMatch(version) });
}

/* --------------------------------------------- doctor links and redemptions */

/** Which doctors offer which services (`GET /doctor-services`), every page. */
export function getDoctorServices(): Promise<DoctorServiceResponse[]> {
  return fetchAllPages(async (page) => {
    const response = await hospitalApi.get('/doctor-services', {
      params: { page, page_size: MAX_PAGE_SIZE },
    });
    return doctorServicePageSchema.parse(response.data);
  });
}

function overridePaise(rupees: number | null): number | null {
  return rupees === null ? null : paise(rupees);
}

/** Link a doctor to a service, optionally at their own price. */
export async function postDoctorService(
  input: DoctorServiceLinkInput,
): Promise<DoctorServiceResponse> {
  const response = await hospitalApi.post('/doctor-services', {
    doctor_id: input.doctorId,
    service_id: input.serviceId,
    price_override_paise: overridePaise(input.priceOverrideRupees),
  });
  return doctorServiceResponseSchema.parse(response.data);
}

/** Only the price override is editable on a link (no row version, so no `If-Match`). */
export async function patchDoctorService(
  id: string,
  priceOverrideRupees: number | null,
): Promise<DoctorServiceResponse> {
  const response = await hospitalApi.patch(`/doctor-services/${encodeURIComponent(id)}`, {
    price_override_paise: overridePaise(priceOverrideRupees),
  });
  return doctorServiceResponseSchema.parse(response.data);
}

export async function deleteDoctorService(id: string): Promise<void> {
  await hospitalApi.delete(`/doctor-services/${encodeURIComponent(id)}`);
}

/** The bookings a coupon was used on, newest first, every page. */
export function getCouponRedemptions(couponId: string): Promise<CouponRedemptionResponse[]> {
  return fetchAllPages(async (page) => {
    const response = await hospitalApi.get(`/coupons/${encodeURIComponent(couponId)}/redemptions`, {
      params: { page, page_size: MAX_PAGE_SIZE, sort: '-redeemed_at' },
    });
    return couponRedemptionPageSchema.parse(response.data);
  });
}
