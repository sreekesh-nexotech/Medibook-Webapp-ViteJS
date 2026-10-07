import type { Result } from '@/core/error/failure';

import type { DoctorServiceLink } from '@/features/settings/domain/entities/services.entities';
import { servicesRepository } from '@/features/settings/infrastructure/repositories/services.repository.impl';

export function fetchDoctorServices(): Promise<Result<readonly DoctorServiceLink[]>> {
  return servicesRepository.listDoctorServices();
}
