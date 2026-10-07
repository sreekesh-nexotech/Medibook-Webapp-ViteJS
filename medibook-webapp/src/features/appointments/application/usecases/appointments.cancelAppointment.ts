import type { Result } from '@/core/error/failure';

import type { RefundOutcome } from '@/features/appointments/domain/entities/appointments.entities';
import { appointmentsRepository } from '@/features/appointments/infrastructure/repositories/appointments.repository.impl';

export function cancelAppointment(
  id: string,
  reason: string,
  idempotencyKey: string,
): Promise<Result<RefundOutcome>> {
  return appointmentsRepository.cancel(id, reason, idempotencyKey);
}
