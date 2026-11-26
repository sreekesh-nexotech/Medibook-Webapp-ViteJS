import { rupeesToPaise, toApiValue } from '@/features/ops-coupons/domain/couponRules';
import type { PlatformCouponInput } from '@/features/ops-coupons/domain/entities/coupons.entities';

/**
 * `POST` / `PATCH /platform/coupons` body. Who pays (`funded_by`) and online-only are not sent:
 * the server sets them for a Medibook coupon and refuses them in the body.
 */
export interface CouponWriteRequest {
  readonly code: string;
  readonly kind: 'percent' | 'flat';
  readonly value: number;
  readonly max_discount_paise: number | null;
  readonly min_order_paise: number;
  readonly valid_from: string;
  readonly valid_to: string;
  readonly usage_cap: number | null;
  readonly per_user_cap: number | null;
  readonly is_active: boolean;
}

export function toCouponWriteRequest(input: PlatformCouponInput): CouponWriteRequest {
  return {
    code: input.code,
    kind: input.kind,
    value: toApiValue(input.kind, input.value),
    max_discount_paise:
      input.kind === 'percent' && input.maxDiscountRupees !== null
        ? rupeesToPaise(input.maxDiscountRupees)
        : null,
    min_order_paise: rupeesToPaise(input.minOrderRupees),
    valid_from: input.validFrom,
    valid_to: input.validTo,
    usage_cap: input.usageCap,
    per_user_cap: input.perUserCap,
    is_active: input.isActive,
  };
}
