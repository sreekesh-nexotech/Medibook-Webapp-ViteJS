import type { Result } from '@/core/error/failure';

import type {
  AppointmentList,
  AppointmentRange,
} from '@/features/appointments/domain/entities/appointments.entities';
import { appointmentsRepository } from '@/features/appointments/infrastructure/repositories/appointments.repository.impl';

export function fetchAppointments(range: AppointmentRange): Promise<Result<AppointmentList>> {
  return appointmentsRepository.list(range);
}
