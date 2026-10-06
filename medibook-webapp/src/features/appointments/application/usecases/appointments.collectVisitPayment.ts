import type { Result } from '@/core/error/failure';

import type {
  DeskReceipt,
  PaymentLineInput,
} from '@/features/appointments/domain/entities/appointments.entities';
import { appointmentsRepository } from '@/features/appointments/infrastructure/repositories/appointments.repository.impl';

export function collectVisitPayment(
  visitId: string,
  lines: readonly PaymentLineInput[],
): Promise<Result<DeskReceipt>> {
  return appointmentsRepository.collectVisitPayment(visitId, lines);
}
