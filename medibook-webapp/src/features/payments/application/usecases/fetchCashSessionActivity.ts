import type { Result } from '@/core/error/failure';

import type { CashSessionActivity } from '@/features/payments/domain/entities/payments.entities';
import { paymentsRepository } from '@/features/payments/infrastructure/repositories/payments.repository.impl';

export function fetchCashSessionActivity(
  sessionId: string,
  businessDate: string,
): Promise<Result<CashSessionActivity>> {
  return paymentsRepository.getCashSessionActivity(sessionId, businessDate);
}
