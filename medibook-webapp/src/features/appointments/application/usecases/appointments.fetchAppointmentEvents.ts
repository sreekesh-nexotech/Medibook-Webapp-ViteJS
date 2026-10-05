import type { Result } from '@/core/error/failure';

import type { AppointmentEvent } from '@/features/appointments/domain/entities/appointments.entities';
import { appointmentsRepository } from '@/features/appointments/infrastructure/repositories/appointments.repository.impl';

export function fetchAppointmentEvents(id: string): Promise<Result<readonly AppointmentEvent[]>> {
  return appointmentsRepository.events(id);
}
