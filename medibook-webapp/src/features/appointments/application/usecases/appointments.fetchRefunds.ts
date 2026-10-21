import type { Result } from '@/core/error/failure';

import type { DeskRefund } from '@/features/appointments/domain/entities/appointments.entities';
import { appointmentsRepository } from '@/features/appointments/infrastructure/repositories/appointments.repository.impl';

export function fetchRefunds(id: string): Promise<Result<readonly DeskRefund[]>> {
  return appointmentsRepository.refunds(id);
}
