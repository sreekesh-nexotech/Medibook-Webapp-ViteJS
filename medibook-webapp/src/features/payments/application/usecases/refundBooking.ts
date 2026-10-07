import type { Result } from '@/core/error/failure';

import type { RefundOutcome } from '@/features/payments/domain/entities/payments.entities';
import { paymentsRepository } from '@/features/payments/infrastructure/repositories/payments.repository.impl';

export function refundBooking(
  appointmentId: string,
  reason: string,
  idempotencyKey: string,
): Promise<Result<RefundOutcome>> {
  return paymentsRepository.refundBooking(appointmentId, reason, idempotencyKey);
}
