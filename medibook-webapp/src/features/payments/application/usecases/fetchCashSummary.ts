import type { Result } from '@/core/error/failure';

import type { CashSummary } from '@/features/payments/domain/entities/payments.entities';
import { paymentsRepository } from '@/features/payments/infrastructure/repositories/payments.repository.impl';

/** `date` `null` = the hospital's own today. */
export function fetchCashSummary(date: string | null): Promise<Result<CashSummary>> {
  return paymentsRepository.getCashSummary(date);
}
