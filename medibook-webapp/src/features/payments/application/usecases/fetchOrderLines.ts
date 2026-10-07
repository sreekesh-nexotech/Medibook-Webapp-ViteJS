import type { Result } from '@/core/error/failure';

import type { PaymentLine } from '@/features/payments/domain/entities/payments.entities';
import { paymentsRepository } from '@/features/payments/infrastructure/repositories/payments.repository.impl';

export function fetchOrderLines(
  orderId: string,
  bookingRef: string | null,
): Promise<Result<readonly PaymentLine[]>> {
  return paymentsRepository.listOrderLines(orderId, bookingRef);
}
