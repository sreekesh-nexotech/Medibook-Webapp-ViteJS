import { attempt } from '@/core/error/attempt';

import type { PlansRepository } from '@/features/ops-plans/domain/repositories/plans.repository';
import {
  deletePlan,
  getPlans,
  getSubscriberCount,
  patchPlan,
  postPlan,
  postPlanArchive,
} from '@/features/ops-plans/infrastructure/data-sources/remote/plans.api';
import {
  toPlanCreateRequest,
  toPlanWriteRequest,
} from '@/features/ops-plans/infrastructure/data-sources/remote/plans.request';
import { toCatalogPlan } from '@/features/ops-plans/infrastructure/data-sources/remote/plans.response';

export const plansRepository: PlansRepository = {
  listPlans: () => attempt(async () => (await getPlans()).map(toCatalogPlan)),

  countSubscribers: (planId) => attempt(() => getSubscriberCount(planId)),

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
};
