import type { Result } from '@/core/error/failure';

import type {
  CouponInput,
  HospitalCoupon,
} from '@/features/settings/domain/entities/services.entities';
import { servicesRepository } from '@/features/settings/infrastructure/repositories/services.repository.impl';

export function createCoupon(input: CouponInput): Promise<Result<HospitalCoupon>> {
  return servicesRepository.createCoupon(input);
}
