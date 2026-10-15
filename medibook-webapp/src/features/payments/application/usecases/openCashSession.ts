import type { Result } from '@/core/error/failure';

import type { CashSession } from '@/features/payments/domain/entities/payments.entities';
import { paymentsRepository } from '@/features/payments/infrastructure/repositories/payments.repository.impl';

export function openCashSession(
  openingFloatPaise: number,
  counterId: string | null,
  idempotencyKey: string,
): Promise<Result<CashSession>> {
  return paymentsRepository.openCashSession(openingFloatPaise, counterId, idempotencyKey);
}
