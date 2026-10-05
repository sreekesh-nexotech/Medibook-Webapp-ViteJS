import type { Result } from '@/core/error/failure';

import type {
  DoctorInput,
  DoctorProfile,
  ScheduleChange,
} from '@/features/doctors/domain/entities/doctors.types';
import { doctorsRepository } from '@/features/doctors/infrastructure/repositories/doctors.repository.impl';

export function updateDoctor(
  id: string,
  input: DoctorInput,
  version: number,
  confirm: boolean,
): Promise<Result<ScheduleChange<DoctorProfile>>> {
  return doctorsRepository.updateDoctor(id, input, version, confirm);
}
