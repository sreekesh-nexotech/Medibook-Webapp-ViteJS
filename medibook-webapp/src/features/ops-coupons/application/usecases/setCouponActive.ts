import type { Result } from '@/core/error/failure';

import type { PlatformCoupon } from '@/features/ops-coupons/domain/entities/coupons.entities';
import { couponsRepository } from '@/features/ops-coupons/infrastructure/repositories/coupons.repository.impl';

/** Pause or resume a coupon; a paused code keeps its window and uses but cannot be applied. */
export function setCouponActive(
  coupon: PlatformCoupon,
  active: boolean,
): Promise<Result<PlatformCoupon>> {
  return couponsRepository.setActive(coupon.id, coupon.version, active);
}
