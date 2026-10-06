import type { Result } from '@/core/error/failure';

import type { CashSession } from '@/features/payments/domain/entities/payments.entities';
import { paymentsRepository } from '@/features/payments/infrastructure/repositories/payments.repository.impl';

export function closeCashSession(
  id: string,
  countedCashPaise: number,
  note: string | null,
): Promise<Result<CashSession>> {
  return paymentsRepository.closeCashSession(id, countedCashPaise, note);
}
