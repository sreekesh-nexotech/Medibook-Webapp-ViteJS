import type { Result } from '@/core/error/failure';

import type { BillingSubscription } from '@/features/ops-billing/domain/entities/billing.entities';
import { billingRepository } from '@/features/ops-billing/infrastructure/repositories/billing.repository.impl';

export function fetchSubscription(id: string): Promise<Result<BillingSubscription>> {
  return billingRepository.getSubscription(id);
}
