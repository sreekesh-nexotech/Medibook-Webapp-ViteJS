import type { Result } from '@/core/error/failure';

import type { BillingUsage } from '@/features/settlements/domain/entities/billing.entities';
import { billingRepository } from '@/features/settlements/infrastructure/repositories/billing.repository.impl';

export function fetchBillingUsage(): Promise<Result<BillingUsage>> {
  return billingRepository.getUsage();
}
