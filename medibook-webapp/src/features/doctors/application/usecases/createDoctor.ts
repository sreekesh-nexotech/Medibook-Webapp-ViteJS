import type { Result } from '@/core/error/failure';

import type { DoctorInput, DoctorProfile } from '@/features/doctors/domain/entities/doctors.types';
import { doctorsRepository } from '@/features/doctors/infrastructure/repositories/doctors.repository.impl';

export function createDoctor(input: DoctorInput): Promise<Result<DoctorProfile>> {
  return doctorsRepository.createDoctor(input);
}
