import type { Result } from '@/core/error/failure';

import type {
  ScheduleChange,
  WeeklySession,
} from '@/features/doctors/domain/entities/doctors.types';
import { doctorsRepository } from '@/features/doctors/infrastructure/repositories/doctors.repository.impl';

export function replaceWeeklySessions(
  doctorId: string,
  sessions: readonly WeeklySession[],
  version: number,
  confirm: boolean,
): Promise<Result<ScheduleChange>> {
  return doctorsRepository.replaceWeeklySessions(doctorId, sessions, version, confirm);
}
