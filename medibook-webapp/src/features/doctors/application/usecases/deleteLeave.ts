import type { Result } from '@/core/error/failure';

import type { ScheduleChange } from '@/features/doctors/domain/entities/doctors.types';
import { doctorsRepository } from '@/features/doctors/infrastructure/repositories/doctors.repository.impl';

export function deleteLeave(
  doctorId: string,
  leaveId: string,
  confirm: boolean,
  version: number,
): Promise<Result<ScheduleChange>> {
  return doctorsRepository.deleteLeave(doctorId, leaveId, confirm, version);
}
