import type { Result } from '@/core/error/failure';

import type {
  PlatformCoupon,
  PlatformCouponInput,
} from '@/features/ops-coupons/domain/entities/coupons.entities';
import { couponsRepository } from '@/features/ops-coupons/infrastructure/repositories/coupons.repository.impl';

/** Create a coupon (`target` null) or edit one, guarded by the version it was opened on. */
export function saveCoupon(
  target: PlatformCoupon | null,
  input: PlatformCouponInput,
): Promise<Result<PlatformCoupon>> {
  return target
    ? couponsRepository.updateCoupon(target.id, target.version, input)
    : couponsRepository.createCoupon(input);
}
