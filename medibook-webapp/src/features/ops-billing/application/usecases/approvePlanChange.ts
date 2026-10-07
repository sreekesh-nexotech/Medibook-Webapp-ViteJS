import type { Result } from '@/core/error/failure';

import type { PlanChangeApproval } from '@/features/ops-billing/domain/entities/billing.entities';
import { billingRepository } from '@/features/ops-billing/infrastructure/repositories/billing.repository.impl';

export function approvePlanChange(id: string): Promise<Result<PlanChangeApproval>> {
  return billingRepository.approvePlanChange(id);
}
