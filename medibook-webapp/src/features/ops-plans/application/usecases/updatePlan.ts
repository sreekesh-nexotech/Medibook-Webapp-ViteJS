import type { Result } from '@/core/error/failure';

import type {
  CatalogPlan,
  CatalogPlanDraft,
} from '@/features/ops-plans/domain/entities/plans.catalog';
import { plansRepository } from '@/features/ops-plans/infrastructure/repositories/plans.repository.impl';

export function updatePlan(
  planId: string,
  draft: CatalogPlanDraft,
  version: number,
): Promise<Result<CatalogPlan>> {
  return plansRepository.updatePlan(planId, draft, version);
}
