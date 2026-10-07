import { z } from 'zod';

import type {
  CouponRedemption,
  DoctorServiceLink,
  HospitalCoupon,
  PricedService,
  ServiceTaxRate,
} from '@/features/settings/domain/entities/services.entities';

/** Paise per rupee — money crosses the API boundary in paise. */
export const PAISE_PER_RUPEE = 100;

/** Basis points per percentage point — rates cross the boundary in bp. */
export const BP_PER_PERCENT = 100;

export const serviceResponseSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  department_id: z.string().nullable(),
  description: z.string().nullable(),
  duration_min: z.number().int(),
  price_paise: z.number().int(),
  tax_rate_id: z.string().nullable(),
  requires_doctor: z.boolean().optional(),
  is_active: z.boolean(),
  version: z.number().int(),
});

export const doctorServiceResponseSchema = z.object({
  id: z.string(),
  doctor_id: z.string(),
  service_id: z.string(),
  price_override_paise: z.number().int().nullable(),
});

export const couponRedemptionResponseSchema = z.object({
  id: z.string(),
  appointment_id: z.string(),
  booking_ref: z.string(),
  discount_paise: z.number().int(),
  redeemed_at: z.string(),
  reversed_at: z.string().nullable(),
});

export const taxRateResponseSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  rate_bp: z.number().int(),
  is_inclusive: z.boolean(),
  applies_to: z.enum(['consultation', 'service', 'convenience_fee', 'all']),
  is_active: z.boolean(),
  is_platform_default: z.boolean(),
  version: z.number().int(),
});

const couponScopeSchema = z.object({
  department_id: z.string().nullable().optional(),
  service_id: z.string().nullable().optional(),
});

export const couponResponseSchema = z.object({
  id: z.string(),
  code: z.string(),
  kind: z.enum(['percent', 'flat']),
  value: z.number().int(),
  min_order_paise: z.number().int(),
  valid_from: z.string(),
  valid_to: z.string(),
  usage_cap: z.number().int().nullable(),
  // Optional so an older backend without them still parses.
  per_user_cap: z.number().int().nullable().optional(),
  max_discount_paise: z.number().int().nullable().optional(),
  applies_to_online_only: z.boolean().optional(),
  used_count: z.number().int(),
  is_active: z.boolean(),
  scopes: z.array(couponScopeSchema).optional(),
  version: z.number().int(),
});

export type ServiceResponse = z.infer<typeof serviceResponseSchema>;
export type TaxRateResponse = z.infer<typeof taxRateResponseSchema>;
export type CouponResponse = z.infer<typeof couponResponseSchema>;
export type DoctorServiceResponse = z.infer<typeof doctorServiceResponseSchema>;
export type CouponRedemptionResponse = z.infer<typeof couponRedemptionResponseSchema>;

export function toDoctorServiceLink(dto: DoctorServiceResponse): DoctorServiceLink {
  return {
    id: dto.id,
    doctorId: dto.doctor_id,
    serviceId: dto.service_id,
    priceOverrideRupees:
      dto.price_override_paise === null ? null : dto.price_override_paise / PAISE_PER_RUPEE,
  };
}

export function toCouponRedemption(dto: CouponRedemptionResponse): CouponRedemption {
  return {
    id: dto.id,
    appointmentId: dto.appointment_id,
    bookingRef: dto.booking_ref,
    discountRupees: dto.discount_paise / PAISE_PER_RUPEE,
    redeemedAt: dto.redeemed_at,
    reversedAt: dto.reversed_at,
  };
}

export function toService(dto: ServiceResponse): PricedService {
  return {
    id: dto.id,
    code: dto.code,
    name: dto.name,
    departmentId: dto.department_id,
    description: dto.description ?? '',
    durationMinutes: dto.duration_min,
    priceRupees: dto.price_paise / PAISE_PER_RUPEE,
    taxRateId: dto.tax_rate_id,
    requiresDoctor: dto.requires_doctor ?? false,
    isActive: dto.is_active,
    version: dto.version,
  };
}

export function toTaxRate(dto: TaxRateResponse): ServiceTaxRate {
  return {
    id: dto.id,
    code: dto.code,
    name: dto.name,
    percent: dto.rate_bp / BP_PER_PERCENT,
    isInclusive: dto.is_inclusive,
    appliesTo: dto.applies_to,
    isActive: dto.is_active,
    isPlatformDefault: dto.is_platform_default,
    version: dto.version,
  };
}

export function toCoupon(dto: CouponResponse): HospitalCoupon {
  const scopes = dto.scopes ?? [];
  return {
    id: dto.id,
    code: dto.code,
    kind: dto.kind,
    // Percent coupons are stored in basis points, flat ones in paise.
    value: dto.kind === 'percent' ? dto.value / BP_PER_PERCENT : dto.value / PAISE_PER_RUPEE,
    validFrom: dto.valid_from,
    validTo: dto.valid_to,
    usageCap: dto.usage_cap,
    perUserCap: dto.per_user_cap ?? null,
    usedCount: dto.used_count,
    maxDiscountRupees:
      dto.max_discount_paise == null ? null : dto.max_discount_paise / PAISE_PER_RUPEE,
    onlineOnly: dto.applies_to_online_only ?? false,
    minOrderRupees: dto.min_order_paise / PAISE_PER_RUPEE,
    departmentIds: scopes.flatMap((s) => (s.department_id ? [s.department_id] : [])),
    serviceIds: scopes.flatMap((s) => (s.service_id ? [s.service_id] : [])),
    isActive: dto.is_active,
    version: dto.version,
  };
}
