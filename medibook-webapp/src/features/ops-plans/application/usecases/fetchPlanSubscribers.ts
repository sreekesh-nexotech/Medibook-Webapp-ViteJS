import type { Page } from '@/core/api/pagination';
import type { Result } from '@/core/error/failure';

import type { PlanSubscriber } from '@/features/ops-plans/domain/entities/plans.catalog';
import { plansRepository } from '@/features/ops-plans/infrastructure/repositories/plans.repository.impl';

export function fetchPlanSubscribers(
  planId: string,
  page: number,
  pageSize: number,
): Promise<Result<Page<PlanSubscriber>>> {
  return plansRepository.listSubscribers(planId, page, pageSize);
}
