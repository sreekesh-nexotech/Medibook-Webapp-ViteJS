import type { Result } from '@/core/error/failure';

import type { CatalogPlan } from '@/features/ops-plans/domain/entities/plans.catalog';
import { plansRepository } from '@/features/ops-plans/infrastructure/repositories/plans.repository.impl';

export function unarchivePlan(planId: string, version: number): Promise<Result<CatalogPlan>> {
  return plansRepository.unarchivePlan(planId, version);
}
