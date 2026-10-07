import type { Result } from '@/core/error/failure';

import type {
  LeaveInput,
  ScheduleChange,
  ScheduleWriteMode,
} from '@/features/doctors/domain/entities/doctors.types';
import { doctorsRepository } from '@/features/doctors/infrastructure/repositories/doctors.repository.impl';

export function createLeave(
  doctorId: string,
  input: LeaveInput,
  mode: ScheduleWriteMode,
): Promise<Result<ScheduleChange>> {
  return doctorsRepository.createLeave(doctorId, input, mode);
}
