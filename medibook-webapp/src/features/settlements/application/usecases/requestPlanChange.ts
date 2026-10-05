import type { Result } from '@/core/error/failure';

import type {
  PlanChangeInput,
  PlanChangeRequest,
} from '@/features/settlements/domain/entities/billing.entities';
import { billingRepository } from '@/features/settlements/infrastructure/repositories/billing.repository.impl';

export function requestPlanChange(input: PlanChangeInput): Promise<Result<PlanChangeRequest>> {
  return billingRepository.requestPlanChange(input);
}
