import type { Result } from '@/core/error/failure';

import type {
  DoctorFilters,
  DoctorProfile,
} from '@/features/doctors/domain/entities/doctors.types';
import { doctorsRepository } from '@/features/doctors/infrastructure/repositories/doctors.repository.impl';

export function fetchDoctors(
  filters: DoctorFilters = {},
): Promise<Result<readonly DoctorProfile[]>> {
  return doctorsRepository.listDoctors(filters);
}
