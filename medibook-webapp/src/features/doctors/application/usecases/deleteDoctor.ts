import type { Result } from '@/core/error/failure';

import type { ScheduleChange } from '@/features/doctors/domain/entities/doctors.types';
import { doctorsRepository } from '@/features/doctors/infrastructure/repositories/doctors.repository.impl';

export function deleteDoctor(id: string, confirm: boolean): Promise<Result<ScheduleChange>> {
  return doctorsRepository.deleteDoctor(id, confirm);
}
