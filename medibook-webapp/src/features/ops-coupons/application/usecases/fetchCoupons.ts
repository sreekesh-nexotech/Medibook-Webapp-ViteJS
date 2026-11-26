import type { Result } from '@/core/error/failure';

import type { PlatformCoupon } from '@/features/ops-coupons/domain/entities/coupons.entities';
import { couponsRepository } from '@/features/ops-coupons/infrastructure/repositories/coupons.repository.impl';

/** Every Medibook coupon, newest first. */
export function fetchCoupons(): Promise<Result<readonly PlatformCoupon[]>> {
  return couponsRepository.listCoupons();
}
