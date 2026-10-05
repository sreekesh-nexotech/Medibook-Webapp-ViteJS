import type { Page } from '@/core/api/pagination';
import type { Result } from '@/core/error/failure';

import type {
  PaymentLine,
  PaymentPageQuery,
} from '@/features/payments/domain/entities/payments.entities';
import { paymentsRepository } from '@/features/payments/infrastructure/repositories/payments.repository.impl';

export function fetchPayments(query: PaymentPageQuery): Promise<Result<Page<PaymentLine>>> {
  return paymentsRepository.listPayments(query);
}
