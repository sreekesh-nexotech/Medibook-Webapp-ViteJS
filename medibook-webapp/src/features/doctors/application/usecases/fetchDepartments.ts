import type { Result } from '@/core/error/failure';

import type { Department } from '@/features/doctors/domain/entities/doctors.types';
import { doctorsRepository } from '@/features/doctors/infrastructure/repositories/doctors.repository.impl';

export function fetchDepartments(): Promise<Result<readonly Department[]>> {
  return doctorsRepository.listDepartments();
}
