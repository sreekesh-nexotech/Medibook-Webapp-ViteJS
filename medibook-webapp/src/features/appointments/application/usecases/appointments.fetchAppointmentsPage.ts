import type { Result } from '@/core/error/failure';

import type {
  AppointmentListParams,
  AppointmentPage,
} from '@/features/appointments/domain/entities/appointments.entities';
import { appointmentsRepository } from '@/features/appointments/infrastructure/repositories/appointments.repository.impl';

export function fetchAppointmentsPage(
  params: AppointmentListParams,
): Promise<Result<AppointmentPage>> {
  return appointmentsRepository.listPage(params);
}
