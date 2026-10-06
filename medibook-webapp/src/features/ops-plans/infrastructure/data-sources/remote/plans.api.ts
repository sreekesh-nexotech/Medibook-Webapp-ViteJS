import { ifMatch } from '@/core/api/headers';
import { platformApi } from '@/core/api/http';
import { MAX_PAGE_SIZE } from '@/core/api/pagination';

import type {
  PlanCreateRequest,
  PlanWriteRequest,
} from '@/features/ops-plans/infrastructure/data-sources/remote/plans.request';
import {
  planPageResponseSchema,
  planResponseSchema,
  subscriberPageResponseSchema,
  type PlanResponse,
} from '@/features/ops-plans/infrastructure/data-sources/remote/plans.response';

/** Smallest page that still carries the `total` count. */
const COUNT_PAGE_SIZE = 1;

/** `GET /platform/plans` — every page, so the catalog is never silently cut short. */
export async function getPlans(): Promise<PlanResponse[]> {
  const rows: PlanResponse[] = [];
  for (let page = 1; ; page += 1) {
    const response = await platformApi.get('/plans', {
      params: { page, page_size: MAX_PAGE_SIZE },
    });
    const body = planPageResponseSchema.parse(response.data);
    rows.push(...body.results);
    if (!body.has_next) return rows;
  }
}

/** `GET /platform/plans/{id}/subscribers` — the subscriber total only. */
export async function getSubscriberCount(planId: string): Promise<number> {
  const response = await platformApi.get(`/plans/${encodeURIComponent(planId)}/subscribers`, {
    params: { page_size: COUNT_PAGE_SIZE },
  });
  return subscriberPageResponseSchema.parse(response.data).total;
}

export async function postPlan(body: PlanCreateRequest): Promise<PlanResponse> {
  const response = await platformApi.post('/plans', body);
  return planResponseSchema.parse(response.data);
}

export async function patchPlan(
  planId: string,
  body: PlanWriteRequest,
  version: number,
): Promise<PlanResponse> {
  const response = await platformApi.patch(`/plans/${encodeURIComponent(planId)}`, body, {
    headers: ifMatch(version),
  });
  return planResponseSchema.parse(response.data);
}

export async function deletePlan(planId: string): Promise<void> {
  await platformApi.delete(`/plans/${encodeURIComponent(planId)}`);
}

export async function postPlanArchive(planId: string): Promise<PlanResponse> {
  const response = await platformApi.post(`/plans/${encodeURIComponent(planId)}/archive`);
  return planResponseSchema.parse(response.data);
}
