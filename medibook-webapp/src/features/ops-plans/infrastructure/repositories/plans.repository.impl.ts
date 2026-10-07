import { toPage } from '@/core/api/pagination';
import { attempt } from '@/core/error/attempt';

import type { PlansRepository } from '@/features/ops-plans/domain/repositories/plans.repository';
import {
  deletePlan,
  getPlans,
  getSubscriberCount,
  getSubscribers,
  patchPlan,
  patchPlanReactivate,
  postPlan,
  postPlanArchive,
  postPlanUnarchive,
} from '@/features/ops-plans/infrastructure/data-sources/remote/plans.api';
import {
  toPlanCreateRequest,
  toPlanWriteRequest,
} from '@/features/ops-plans/infrastructure/data-sources/remote/plans.request';
import {
  toCatalogPlan,
  toPlanSubscriber,
} from '@/features/ops-plans/infrastructure/data-sources/remote/plans.response';

export const plansRepository: PlansRepository = {
  listPlans: () => attempt(async () => (await getPlans()).map(toCatalogPlan)),

  countSubscribers: (planId) => attempt(() => getSubscriberCount(planId)),

  listSubscribers: (planId, page, pageSize) =>
    attempt(async () => toPage(await getSubscribers(planId, page, pageSize), toPlanSubscriber)),

  createPlan: (draft) =>
    attempt(async () => toCatalogPlan(await postPlan(toPlanCreateRequest(draft)))),

  updatePlan: (planId, draft, version) =>
    attempt(async () => toCatalogPlan(await patchPlan(planId, toPlanWriteRequest(draft), version))),

  deletePlan: (planId) =>
    attempt(async () => {
      await deletePlan(planId);
      return null;
    }),

  archivePlan: (planId) => attempt(async () => toCatalogPlan(await postPlanArchive(planId))),

  unarchivePlan: async (planId, version) => {
    const result = await attempt(async () => toCatalogPlan(await postPlanUnarchive(planId)));
    // A backend without the route answers 404: re-open the plan by editing it instead.
    if (result.ok || result.failure.kind !== 'notFound') return result;
    return attempt(async () => toCatalogPlan(await patchPlanReactivate(planId, version)));
  },
};
