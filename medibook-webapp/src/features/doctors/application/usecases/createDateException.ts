import type { Result } from '@/core/error/failure';

import type {
  DateExceptionInput,
  ScheduleChange,
} from '@/features/doctors/domain/entities/doctors.types';
import { doctorsRepository } from '@/features/doctors/infrastructure/repositories/doctors.repository.impl';

export function createDateException(
  doctorId: string,
  input: DateExceptionInput,
  confirm: boolean,
): Promise<Result<ScheduleChange>> {
  return doctorsRepository.createDateException(doctorId, input, confirm);
}
