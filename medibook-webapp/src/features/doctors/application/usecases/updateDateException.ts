import type { Result } from '@/core/error/failure';

import type {
  DateExceptionInput,
  ScheduleChange,
  ScheduleWriteMode,
} from '@/features/doctors/domain/entities/doctors.types';
import type { VersionedRef } from '@/features/doctors/domain/repositories/doctors.repository';
import { doctorsRepository } from '@/features/doctors/infrastructure/repositories/doctors.repository.impl';

export function updateDateException(
  doctorId: string,
  exception: VersionedRef,
  input: DateExceptionInput,
  mode: ScheduleWriteMode,
): Promise<Result<ScheduleChange>> {
  return doctorsRepository.updateDateException(doctorId, exception, input, mode);
}
