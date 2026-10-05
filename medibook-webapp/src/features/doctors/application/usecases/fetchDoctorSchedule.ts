import type { Result } from '@/core/error/failure';

import type { DoctorScheduleData } from '@/features/doctors/domain/entities/doctors.types';
import { doctorsRepository } from '@/features/doctors/infrastructure/repositories/doctors.repository.impl';

export function fetchDoctorSchedule(doctorId: string): Promise<Result<DoctorScheduleData>> {
  return doctorsRepository.getSchedule(doctorId);
}
