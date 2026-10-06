import type { Result } from '@/core/error/failure';

import type { CouponRedemption } from '@/features/settings/domain/entities/services.entities';
import { servicesRepository } from '@/features/settings/infrastructure/repositories/services.repository.impl';

export function fetchCouponRedemptions(
  couponId: string,
): Promise<Result<readonly CouponRedemption[]>> {
  return servicesRepository.listCouponRedemptions(couponId);
}
