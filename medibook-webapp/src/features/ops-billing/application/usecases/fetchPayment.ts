import type { Result } from '@/core/error/failure';

import type { SubscriptionPayment } from '@/features/ops-billing/domain/entities/billing.entities';
import { billingRepository } from '@/features/ops-billing/infrastructure/repositories/billing.repository.impl';

export function fetchPayment(id: string): Promise<Result<SubscriptionPayment>> {
  return billingRepository.getPayment(id);
}
