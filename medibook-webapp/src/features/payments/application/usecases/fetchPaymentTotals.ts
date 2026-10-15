import type { Result } from '@/core/error/failure';

import type {
  PaymentFilters,
  PaymentLine,
} from '@/features/payments/domain/entities/payments.entities';
import { paymentsRepository } from '@/features/payments/infrastructure/repositories/payments.repository.impl';

/** Every line matching `filters`, for the day's totals. */
export function fetchPaymentTotals(
  filters: PaymentFilters,
): Promise<Result<readonly PaymentLine[]>> {
  return paymentsRepository.listAllPayments(filters);
}
