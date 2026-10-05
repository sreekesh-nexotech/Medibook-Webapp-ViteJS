import type { Result } from '@/core/error/failure';

import type {
  DateExceptionInput,
  ScheduleChange,
} from '@/features/doctors/domain/entities/doctors.types';
import { doctorsRepository } from '@/features/doctors/infrastructure/repositories/doctors.repository.impl';

export function updateDateException(
  doctorId: string,
  exceptionId: string,
  input: DateExceptionInput,
  version: number,
  confirm: boolean,
): Promise<Result<ScheduleChange>> {
  return doctorsRepository.updateDateException(doctorId, exceptionId, input, version, confirm);
}
