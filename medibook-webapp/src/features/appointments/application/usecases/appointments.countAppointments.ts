import type { Result } from '@/core/error/failure';

import type {
  AppointmentRange,
  ApptSource,
} from '@/features/appointments/domain/entities/appointments.entities';
import { appointmentsRepository } from '@/features/appointments/infrastructure/repositories/appointments.repository.impl';

export function countAppointments(
  range: AppointmentRange,
  source: ApptSource | null,
): Promise<Result<number>> {
  return appointmentsRepository.count(range, source);
}
