import type { Result } from '@/core/error/failure';

import type { HospitalCoupon } from '@/features/settings/domain/entities/services.entities';
import { servicesRepository } from '@/features/settings/infrastructure/repositories/services.repository.impl';

export function fetchCoupons(): Promise<Result<readonly HospitalCoupon[]>> {
  return servicesRepository.listCoupons();
}
