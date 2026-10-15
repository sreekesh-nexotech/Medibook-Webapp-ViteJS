import type { Result } from '@/core/error/failure';

import type {
  DateExceptionInput,
  ScheduleChange,
  ScheduleWriteMode,
} from '@/features/doctors/domain/entities/doctors.types';
import { doctorsRepository } from '@/features/doctors/infrastructure/repositories/doctors.repository.impl';

export function createDateException(
  doctorId: string,
  input: DateExceptionInput,
  mode: ScheduleWriteMode,
): Promise<Result<ScheduleChange>> {
  return doctorsRepository.createDateException(doctorId, input, mode);
}
