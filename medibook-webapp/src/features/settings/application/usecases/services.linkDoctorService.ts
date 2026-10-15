import type { Result } from '@/core/error/failure';

import type {
  DoctorServiceLink,
  DoctorServiceLinkInput,
} from '@/features/settings/domain/entities/services.entities';
import { servicesRepository } from '@/features/settings/infrastructure/repositories/services.repository.impl';

export function linkDoctorService(
  input: DoctorServiceLinkInput,
): Promise<Result<DoctorServiceLink>> {
  return servicesRepository.linkDoctorService(input);
}
