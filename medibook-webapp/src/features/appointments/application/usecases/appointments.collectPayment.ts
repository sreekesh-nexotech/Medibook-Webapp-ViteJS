import type { Result } from '@/core/error/failure';

import type {
  DeskReceipt,
  PaymentLineInput,
} from '@/features/appointments/domain/entities/appointments.entities';
import { appointmentsRepository } from '@/features/appointments/infrastructure/repositories/appointments.repository.impl';

export function collectPayment(
  id: string,
  lines: readonly PaymentLineInput[],
  replayKey: string,
): Promise<Result<DeskReceipt>> {
  return appointmentsRepository.collectPayment(id, lines, replayKey);
}
