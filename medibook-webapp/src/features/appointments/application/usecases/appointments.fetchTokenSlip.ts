import type { Result } from '@/core/error/failure';

import type { TokenSlipData } from '@/features/appointments/domain/entities/appointments.entities';
import { appointmentsRepository } from '@/features/appointments/infrastructure/repositories/appointments.repository.impl';

export function fetchTokenSlip(id: string): Promise<Result<TokenSlipData>> {
  return appointmentsRepository.tokenSlip(id);
}
