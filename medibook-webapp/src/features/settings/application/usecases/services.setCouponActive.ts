import type { Result } from '@/core/error/failure';

import type { HospitalCoupon } from '@/features/settings/domain/entities/services.entities';
import { servicesRepository } from '@/features/settings/infrastructure/repositories/services.repository.impl';

export function setCouponActive(
  id: string,
  isActive: boolean,
  version: number,
): Promise<Result<HospitalCoupon>> {
  return servicesRepository.setCouponActive(id, isActive, version);
}
