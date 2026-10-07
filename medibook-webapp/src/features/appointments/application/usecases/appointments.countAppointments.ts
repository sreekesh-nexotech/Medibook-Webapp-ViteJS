import type { Result } from '@/core/error/failure';

import type { AppointmentListParams } from '@/features/appointments/domain/entities/appointments.entities';
import { appointmentsRepository } from '@/features/appointments/infrastructure/repositories/appointments.repository.impl';

export function countAppointments(params: AppointmentListParams): Promise<Result<number>> {
  return appointmentsRepository.count(params);
}
