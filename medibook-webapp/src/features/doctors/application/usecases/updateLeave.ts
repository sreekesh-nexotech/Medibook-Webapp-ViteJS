import type { Result } from '@/core/error/failure';

import type {
  LeaveInput,
  ScheduleChange,
  ScheduleWriteMode,
} from '@/features/doctors/domain/entities/doctors.types';
import type { VersionedRef } from '@/features/doctors/domain/repositories/doctors.repository';
import { doctorsRepository } from '@/features/doctors/infrastructure/repositories/doctors.repository.impl';

export function updateLeave(
  doctorId: string,
  leave: VersionedRef,
  input: LeaveInput,
  mode: ScheduleWriteMode,
): Promise<Result<ScheduleChange>> {
  return doctorsRepository.updateLeave(doctorId, leave, input, mode);
}
