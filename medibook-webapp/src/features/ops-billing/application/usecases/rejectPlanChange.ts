import type { Result } from '@/core/error/failure';

import type { PlanChangeRequest } from '@/features/ops-billing/domain/entities/billing.entities';
import { billingRepository } from '@/features/ops-billing/infrastructure/repositories/billing.repository.impl';

export function rejectPlanChange(
  id: string,
  note: string | null,
): Promise<Result<PlanChangeRequest>> {
  return billingRepository.rejectPlanChange(id, note);
}
