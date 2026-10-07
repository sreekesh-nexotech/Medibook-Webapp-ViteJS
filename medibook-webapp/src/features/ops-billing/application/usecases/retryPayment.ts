import type { Result } from '@/core/error/failure';

import { billingRepository } from '@/features/ops-billing/infrastructure/repositories/billing.repository.impl';

export function retryPayment(id: string, idempotencyKey: string): Promise<Result<null>> {
  return billingRepository.retryPayment(id, idempotencyKey);
}
