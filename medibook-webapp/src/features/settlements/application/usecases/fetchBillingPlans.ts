import type { Result } from '@/core/error/failure';

import type { BillingPlan } from '@/features/settlements/domain/entities/billing.entities';
import { billingRepository } from '@/features/settlements/infrastructure/repositories/billing.repository.impl';

export function fetchBillingPlans(): Promise<Result<readonly BillingPlan[]>> {
  return billingRepository.listPlans();
}
