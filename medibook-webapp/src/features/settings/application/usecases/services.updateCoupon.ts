import type { Result } from '@/core/error/failure';

import type {
  CouponInput,
  HospitalCoupon,
} from '@/features/settings/domain/entities/services.entities';
import { servicesRepository } from '@/features/settings/infrastructure/repositories/services.repository.impl';

export function updateCoupon(
  id: string,
  input: CouponInput,
  version: number,
): Promise<Result<HospitalCoupon>> {
  return servicesRepository.updateCoupon(id, input, version);
}
