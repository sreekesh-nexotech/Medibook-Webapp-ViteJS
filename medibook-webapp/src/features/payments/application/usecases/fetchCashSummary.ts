import type { Result } from '@/core/error/failure';

import type { CashSummaryRow } from '@/features/payments/domain/entities/payments.entities';
import { paymentsRepository } from '@/features/payments/infrastructure/repositories/payments.repository.impl';

export function fetchCashSummary(date: string): Promise<Result<readonly CashSummaryRow[]>> {
  return paymentsRepository.getCashSummary(date);
}
