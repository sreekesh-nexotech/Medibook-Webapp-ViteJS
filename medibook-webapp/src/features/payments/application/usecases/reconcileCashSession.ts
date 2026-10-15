import type { Result } from '@/core/error/failure';

import type {
  CashSession,
  CashWriteGuard,
} from '@/features/payments/domain/entities/payments.entities';
import { paymentsRepository } from '@/features/payments/infrastructure/repositories/payments.repository.impl';

export function reconcileCashSession(
  id: string,
  countedCashPaise: number | null,
  note: string | null,
  guard: CashWriteGuard,
): Promise<Result<CashSession>> {
  return paymentsRepository.reconcileCashSession(id, countedCashPaise, note, guard);
}
