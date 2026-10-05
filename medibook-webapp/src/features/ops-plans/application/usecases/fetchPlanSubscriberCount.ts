import type { Result } from '@/core/error/failure';

import { plansRepository } from '@/features/ops-plans/infrastructure/repositories/plans.repository.impl';

export function fetchPlanSubscriberCount(planId: string): Promise<Result<number>> {
  return plansRepository.countSubscribers(planId);
}
