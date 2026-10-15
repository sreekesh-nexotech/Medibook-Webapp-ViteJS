import type { Page } from '@/core/api/pagination';
import type { Result } from '@/core/error/failure';

import type {
  CatalogPlan,
  CatalogPlanDraft,
  PlanSubscriber,
} from '@/features/ops-plans/domain/entities/plans.catalog';

/** The platform's subscription-plan catalog. */
export interface PlansRepository {
  /** Every plan, archived ones included, in the backend's catalog order. */
  listPlans(): Promise<Result<readonly CatalogPlan[]>>;
  /** How many hospitals are on the plan now (cancelled subscriptions excluded). */
  countSubscribers(planId: string): Promise<Result<number>>;
  /** One page of the plan's live subscribers, newest first. */
  listSubscribers(
    planId: string,
    page: number,
    pageSize: number,
  ): Promise<Result<Page<PlanSubscriber>>>;
  createPlan(draft: CatalogPlanDraft): Promise<Result<CatalogPlan>>;
  /** Edit a plan; `version` guards against a concurrent edit. */
  updatePlan(
    planId: string,
    draft: CatalogPlanDraft,
    version: number,
  ): Promise<Result<CatalogPlan>>;
  /** Soft delete — refused by the server for a plan that has ever had subscribers. */
  deletePlan(planId: string): Promise<Result<null>>;
  /** Stop new subscriptions to the plan; existing subscribers keep it. */
  archivePlan(planId: string): Promise<Result<CatalogPlan>>;
  /** Re-open an archived plan to new subscriptions; `version` guards the fallback edit. */
  unarchivePlan(planId: string, version: number): Promise<Result<CatalogPlan>>;
}
