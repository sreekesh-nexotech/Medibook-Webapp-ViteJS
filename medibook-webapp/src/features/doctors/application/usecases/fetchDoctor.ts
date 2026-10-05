import type { Result } from '@/core/error/failure';

import type { DoctorProfile } from '@/features/doctors/domain/entities/doctors.types';
import { doctorsRepository } from '@/features/doctors/infrastructure/repositories/doctors.repository.impl';

export function fetchDoctor(id: string): Promise<Result<DoctorProfile>> {
  return doctorsRepository.getDoctor(id);
}
