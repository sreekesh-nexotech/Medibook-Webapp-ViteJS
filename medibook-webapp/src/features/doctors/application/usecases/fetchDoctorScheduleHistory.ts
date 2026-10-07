import type { Result } from '@/core/error/failure';

import type { DoctorScheduleHistory } from '@/features/doctors/domain/entities/doctors.types';
import { doctorsRepository } from '@/features/doctors/infrastructure/repositories/doctors.repository.impl';

export function fetchDoctorScheduleHistory(
  doctorId: string,
): Promise<Result<DoctorScheduleHistory>> {
  return doctorsRepository.getScheduleHistory(doctorId);
}
