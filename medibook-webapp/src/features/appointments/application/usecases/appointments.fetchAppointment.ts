import type { Result } from '@/core/error/failure';

import type { DeskAppointment } from '@/features/appointments/domain/entities/appointments.entities';
import { appointmentsRepository } from '@/features/appointments/infrastructure/repositories/appointments.repository.impl';

export function fetchAppointment(id: string): Promise<Result<DeskAppointment>> {
  return appointmentsRepository.get(id);
}
