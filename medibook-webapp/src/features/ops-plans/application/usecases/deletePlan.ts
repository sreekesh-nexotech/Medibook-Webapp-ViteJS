import type { Result } from '@/core/error/failure';

import { plansRepository } from '@/features/ops-plans/infrastructure/repositories/plans.repository.impl';

export function deletePlan(planId: string): Promise<Result<null>> {
  return plansRepository.deletePlan(planId);
}
