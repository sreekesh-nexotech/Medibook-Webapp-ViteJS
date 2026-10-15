import type { Result } from '@/core/error/failure';

import type { DoctorServiceLink } from '@/features/settings/domain/entities/services.entities';
import { servicesRepository } from '@/features/settings/infrastructure/repositories/services.repository.impl';

export function updateDoctorServicePrice(
  id: string,
  priceOverrideRupees: number | null,
): Promise<Result<DoctorServiceLink>> {
  return servicesRepository.updateDoctorServicePrice(id, priceOverrideRupees);
}
