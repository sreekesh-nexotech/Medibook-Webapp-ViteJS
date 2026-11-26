import type { Result } from '@/core/error/failure';

import type { PlatformCoupon } from '@/features/ops-coupons/domain/entities/coupons.entities';
import { couponsRepository } from '@/features/ops-coupons/infrastructure/repositories/coupons.repository.impl';

/** Delete a coupon (soft: past bookings and their uses are kept). */
export function removeCoupon(coupon: PlatformCoupon): Promise<Result<null>> {
  return couponsRepository.deleteCoupon(coupon.id, coupon.version);
}
