import type { Result } from '@/core/error/failure';

import type { CashSession } from '@/features/payments/domain/entities/payments.entities';
import { paymentsRepository } from '@/features/payments/infrastructure/repositories/payments.repository.impl';

/** The staff member's open cash drawer, or `null` when it is closed. */
export function fetchOpenCashSession(staffId: string): Promise<Result<CashSession | null>> {
  return paymentsRepository.getOpenCashSession(staffId);
}
