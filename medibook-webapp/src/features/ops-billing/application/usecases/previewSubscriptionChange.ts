import type { Result } from '@/core/error/failure';

import type {
  BillingPeriod,
  ProrationPreview,
} from '@/features/ops-billing/domain/entities/billing.entities';
import { billingRepository } from '@/features/ops-billing/infrastructure/repositories/billing.repository.impl';

export function previewSubscriptionChange(
  id: string,
  planId: string | null,
  billingPeriod: BillingPeriod | null,
): Promise<Result<ProrationPreview | null>> {
  return billingRepository.previewSubscriptionChange(id, planId, billingPeriod);
}
