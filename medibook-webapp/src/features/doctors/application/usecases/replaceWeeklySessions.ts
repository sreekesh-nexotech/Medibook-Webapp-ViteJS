import type { Result } from '@/core/error/failure';

import type {
  ScheduleChange,
  ScheduleWriteMode,
  WeeklySession,
} from '@/features/doctors/domain/entities/doctors.types';
import { doctorsRepository } from '@/features/doctors/infrastructure/repositories/doctors.repository.impl';

export function replaceWeeklySessions(
  doctorId: string,
  sessions: readonly WeeklySession[],
  version: number,
  mode: ScheduleWriteMode,
): Promise<Result<ScheduleChange>> {
  return doctorsRepository.replaceWeeklySessions(doctorId, sessions, version, mode);
}
