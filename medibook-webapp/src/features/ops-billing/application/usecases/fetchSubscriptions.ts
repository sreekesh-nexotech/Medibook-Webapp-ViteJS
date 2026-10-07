import type { Page } from '@/core/api/pagination';
import type { Result } from '@/core/error/failure';

import type {
  BillingSubscription,
  SubscriptionListParams,
} from '@/features/ops-billing/domain/entities/billing.entities';
import { billingRepository } from '@/features/ops-billing/infrastructure/repositories/billing.repository.impl';

export function fetchSubscriptions(
  params: SubscriptionListParams,
): Promise<Result<Page<BillingSubscription>>> {
  return billingRepository.listSubscriptions(params);
}
