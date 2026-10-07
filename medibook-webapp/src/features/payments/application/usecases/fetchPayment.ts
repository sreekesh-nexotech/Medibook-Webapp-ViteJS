import type { Result } from '@/core/error/failure';

import type { PaymentDetail } from '@/features/payments/domain/entities/payments.entities';
import { paymentsRepository } from '@/features/payments/infrastructure/repositories/payments.repository.impl';

export function fetchPayment(paymentId: string): Promise<Result<PaymentDetail>> {
  return paymentsRepository.getPayment(paymentId);
}
