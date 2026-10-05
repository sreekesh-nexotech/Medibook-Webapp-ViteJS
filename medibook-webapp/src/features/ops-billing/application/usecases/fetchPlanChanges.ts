import type { Page } from '@/core/api/pagination';
import type { Result } from '@/core/error/failure';

import type {
  PlanChangeListParams,
  PlanChangeRequest,
} from '@/features/ops-billing/domain/entities/billing.entities';
import { billingRepository } from '@/features/ops-billing/infrastructure/repositories/billing.repository.impl';

export function fetchPlanChanges(
  params: PlanChangeListParams,
): Promise<Result<Page<PlanChangeRequest>>> {
  return billingRepository.listPlanChanges(params);
}
