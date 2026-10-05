import type { Result } from '@/core/error/failure';

import type {
  CatalogPlan,
  CatalogPlanDraft,
} from '@/features/ops-plans/domain/entities/plans.catalog';
import { plansRepository } from '@/features/ops-plans/infrastructure/repositories/plans.repository.impl';

export function createPlan(draft: CatalogPlanDraft): Promise<Result<CatalogPlan>> {
  return plansRepository.createPlan(draft);
}
