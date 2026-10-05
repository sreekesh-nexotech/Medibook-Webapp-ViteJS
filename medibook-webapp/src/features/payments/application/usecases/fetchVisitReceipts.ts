import type { Result } from '@/core/error/failure';

import type { VisitReceipt } from '@/features/payments/domain/entities/payments.entities';
import { paymentsRepository } from '@/features/payments/infrastructure/repositories/payments.repository.impl';

export function fetchVisitReceipts(visitId: string): Promise<Result<readonly VisitReceipt[]>> {
  return paymentsRepository.listVisitReceipts(visitId);
}
