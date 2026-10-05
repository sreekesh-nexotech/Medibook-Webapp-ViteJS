import type { Result } from '@/core/error/failure';

import type { LeaveInput, ScheduleChange } from '@/features/doctors/domain/entities/doctors.types';
import { doctorsRepository } from '@/features/doctors/infrastructure/repositories/doctors.repository.impl';

export function updateLeave(
  doctorId: string,
  leaveId: string,
  input: LeaveInput,
  version: number,
  confirm: boolean,
): Promise<Result<ScheduleChange>> {
  return doctorsRepository.updateLeave(doctorId, leaveId, input, version, confirm);
}
