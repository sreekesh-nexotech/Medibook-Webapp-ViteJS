import type { Result } from '@/core/error/failure';

import type { PlatformCouponUse } from '@/features/ops-coupons/domain/entities/coupons.entities';
import { couponsRepository } from '@/features/ops-coupons/infrastructure/repositories/coupons.repository.impl';

/** Every booking that used this coupon, newest first. */
export function fetchCouponUses(id: string): Promise<Result<readonly PlatformCouponUse[]>> {
  return couponsRepository.listUses(id);
}
