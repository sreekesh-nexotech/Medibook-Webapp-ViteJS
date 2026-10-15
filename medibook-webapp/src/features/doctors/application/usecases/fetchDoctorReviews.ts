import type { Result } from '@/core/error/failure';

import type { DoctorReviewPage } from '@/features/doctors/domain/entities/doctors.types';
import { doctorsRepository } from '@/features/doctors/infrastructure/repositories/doctors.repository.impl';

export function fetchDoctorReviews(
  doctorId: string,
  page: number,
): Promise<Result<DoctorReviewPage>> {
  return doctorsRepository.listReviews(doctorId, page);
}
