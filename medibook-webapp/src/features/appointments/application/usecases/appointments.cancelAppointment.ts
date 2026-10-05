import type { Result } from '@/core/error/failure';

import type { DeskAppointment } from '@/features/appointments/domain/entities/appointments.entities';
import { appointmentsRepository } from '@/features/appointments/infrastructure/repositories/appointments.repository.impl';

export function cancelAppointment(id: string, reason: string): Promise<Result<DeskAppointment>> {
  return appointmentsRepository.cancel(id, reason);
}
