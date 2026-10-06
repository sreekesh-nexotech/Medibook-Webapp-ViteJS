import type { Result } from '@/core/error/failure';

import type { CashSession } from '@/features/payments/domain/entities/payments.entities';
import { paymentsRepository } from '@/features/payments/infrastructure/repositories/payments.repository.impl';

export function fetchCashSessionsToReconcile(): Promise<Result<readonly CashSession[]>> {
  return paymentsRepository.listCashSessionsToReconcile();
}
