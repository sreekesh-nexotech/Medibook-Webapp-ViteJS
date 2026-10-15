import type { Result } from '@/core/error/failure';

import type {
  SubscriptionChange,
  SubscriptionChangeResult,
} from '@/features/ops-billing/domain/entities/billing.entities';
import { billingRepository } from '@/features/ops-billing/infrastructure/repositories/billing.repository.impl';

export function changeSubscription(
  id: string,
  change: SubscriptionChange,
  version: number | null,
): Promise<Result<SubscriptionChangeResult>> {
  return billingRepository.changeSubscription(id, change, version);
}
