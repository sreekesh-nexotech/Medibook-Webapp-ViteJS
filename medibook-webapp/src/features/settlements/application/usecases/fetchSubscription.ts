import type { Result } from '@/core/error/failure';

import type { Subscription } from '@/features/settlements/domain/entities/billing.entities';
import { billingRepository } from '@/features/settlements/infrastructure/repositories/billing.repository.impl';

export function fetchSubscription(): Promise<Result<Subscription>> {
  return billingRepository.getSubscription();
}
