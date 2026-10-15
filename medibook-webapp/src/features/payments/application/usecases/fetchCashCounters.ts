import type { Result } from '@/core/error/failure';

import type { CashCounter } from '@/features/payments/domain/entities/payments.entities';
import { paymentsRepository } from '@/features/payments/infrastructure/repositories/payments.repository.impl';

export function fetchCashCounters(): Promise<Result<readonly CashCounter[]>> {
  return paymentsRepository.listCounters();
}
