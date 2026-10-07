import type { Result } from '@/core/error/failure';

import type {
  ScheduleChange,
  ScheduleWriteMode,
} from '@/features/doctors/domain/entities/doctors.types';
import type { VersionedRef } from '@/features/doctors/domain/repositories/doctors.repository';
import { doctorsRepository } from '@/features/doctors/infrastructure/repositories/doctors.repository.impl';

export function deleteDateException(
  doctorId: string,
  exception: VersionedRef,
  mode: ScheduleWriteMode,
): Promise<Result<ScheduleChange>> {
  return doctorsRepository.deleteDateException(doctorId, exception, mode);
}
