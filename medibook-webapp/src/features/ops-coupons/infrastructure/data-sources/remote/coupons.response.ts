import { z } from 'zod';

import { paginatedSchema } from '@/core/api/pagination';

import { fromApiValue, paiseToRupees } from '@/features/ops-coupons/domain/couponRules';
import type {
  PlatformCoupon,
  PlatformCouponUse,
} from '@/features/ops-coupons/domain/entities/coupons.entities';

/** `PlatformCouponSerializer` (backend `catalog/serializers/platform_coupon_serializer.py`). */
export const couponResponseSchema = z.object({
  id: z.string(),
  code: z.string(),
  kind: z.enum(['percent', 'flat']),
  value: z.number().int(),
  max_discount_paise: z.number().int().nullable(),
  min_order_paise: z.number().int(),
  valid_from: z.string(),
  valid_to: z.string(),
  usage_cap: z.number().int().nullable(),
  per_user_cap: z.number().int().nullable(),
  used_count: z.number().int(),
  is_active: z.boolean(),
  funded_by: z.string().optional(),
  created_at: z.string(),
  version: z.number().int(),
});

export const couponPageResponseSchema = paginatedSchema(couponResponseSchema);

/** `PlatformCouponRedemptionSerializer`. */
export const couponUseResponseSchema = z.object({
  id: z.string(),
  hospital_id: z.string().nullish(),
  hospital_name: z.string().nullish(),
  appointment_id: z.string().nullish(),
  booking_ref: z.string().nullish(),
  discount_paise: z.number().int(),
  funded_by: z.string().optional(),
  redeemed_at: z.string(),
  reversed_at: z.string().nullable(),
});

export const couponUsePageResponseSchema = paginatedSchema(couponUseResponseSchema);

export type CouponResponse = z.infer<typeof couponResponseSchema>;
export type CouponUseResponse = z.infer<typeof couponUseResponseSchema>;

export function toPlatformCoupon(dto: CouponResponse): PlatformCoupon {
  return {
    id: dto.id,
    code: dto.code,
    kind: dto.kind,
    value: fromApiValue(dto.kind, dto.value),
    maxDiscountRupees:
      dto.max_discount_paise === null ? null : paiseToRupees(dto.max_discount_paise),
    minOrderRupees: paiseToRupees(dto.min_order_paise),
    validFrom: dto.valid_from,
    validTo: dto.valid_to,
    usageCap: dto.usage_cap,
    perUserCap: dto.per_user_cap,
    usedCount: dto.used_count,
    isActive: dto.is_active,
    createdAt: dto.created_at,
    version: dto.version,
  };
}

export function toCouponUse(dto: CouponUseResponse): PlatformCouponUse {
  return {
    id: dto.id,
    hospitalName: dto.hospital_name ?? '—',
    bookingRef: dto.booking_ref ?? '—',
    discountRupees: paiseToRupees(dto.discount_paise),
    redeemedAt: dto.redeemed_at,
    reversedAt: dto.reversed_at,
  };
}
