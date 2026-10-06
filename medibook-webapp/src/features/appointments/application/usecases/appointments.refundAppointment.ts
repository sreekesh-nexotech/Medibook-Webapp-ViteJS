import type { Result } from '@/core/error/failure';

import { appointmentsRepository } from '@/features/appointments/infrastructure/repositories/appointments.repository.impl';

export function refundAppointment(
  id: string,
  reason: string,
  replayKey: string,
): Promise<Result<null>> {
  return appointmentsRepository.refund(id, reason, replayKey);
}
