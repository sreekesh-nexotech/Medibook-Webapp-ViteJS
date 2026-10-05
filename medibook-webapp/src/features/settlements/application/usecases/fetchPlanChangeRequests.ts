import type { Result } from '@/core/error/failure';

import type { PlanChangeRequest } from '@/features/settlements/domain/entities/billing.entities';
import { billingRepository } from '@/features/settlements/infrastructure/repositories/billing.repository.impl';

export function fetchPlanChangeRequests(): Promise<Result<readonly PlanChangeRequest[]>> {
  return billingRepository.listPlanChangeRequests();
}
