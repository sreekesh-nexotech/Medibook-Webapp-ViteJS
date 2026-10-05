import type { Result } from '@/core/error/failure';

import type { CatalogPlan } from '@/features/ops-plans/domain/entities/plans.catalog';
import { plansRepository } from '@/features/ops-plans/infrastructure/repositories/plans.repository.impl';

export function archivePlan(planId: string): Promise<Result<CatalogPlan>> {
  return plansRepository.archivePlan(planId);
}
