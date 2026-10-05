import type { Result } from '@/core/error/failure';

import type { DeskReceipt } from '@/features/appointments/domain/entities/appointments.entities';
import { appointmentsRepository } from '@/features/appointments/infrastructure/repositories/appointments.repository.impl';

export function fetchReceipt(id: string): Promise<Result<DeskReceipt>> {
  return appointmentsRepository.receipt(id);
}
