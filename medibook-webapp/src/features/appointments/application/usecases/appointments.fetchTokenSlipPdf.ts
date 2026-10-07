import type { Result } from '@/core/error/failure';

import { appointmentsRepository } from '@/features/appointments/infrastructure/repositories/appointments.repository.impl';

export function fetchTokenSlipPdf(id: string): Promise<Result<Blob>> {
  return appointmentsRepository.tokenSlipPdf(id);
}
