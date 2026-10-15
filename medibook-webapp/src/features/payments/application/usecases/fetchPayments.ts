import type { Result } from '@/core/error/failure';

import type {
  PaymentPage,
  PaymentPageQuery,
} from '@/features/payments/domain/entities/payments.entities';
import { paymentsRepository } from '@/features/payments/infrastructure/repositories/payments.repository.impl';

export function fetchPayments(query: PaymentPageQuery): Promise<Result<PaymentPage>> {
  return paymentsRepository.listPayments(query);
}
