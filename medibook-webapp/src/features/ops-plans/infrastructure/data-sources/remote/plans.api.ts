import { ifMatch } from '@/core/api/headers';
import { platformApi } from '@/core/api/http';
import { MAX_PAGE_SIZE } from '@/core/api/pagination';

import { LIVE_SUBSCRIBER_STATUSES } from '@/features/ops-plans/domain/entities/plans.catalog';
import type {
  PlanCreateRequest,
  PlanReactivateRequest,
  PlanWriteRequest,
} from '@/features/ops-plans/infrastructure/data-sources/remote/plans.request';
import {
  planPageResponseSchema,
  planResponseSchema,
  subscriberPageResponseSchema,
  subscriberRowsPageSchema,
  type PlanResponse,
} from '@/features/ops-plans/infrastructure/data-sources/remote/plans.response';

/** Smallest page that still carries the `total` count. */
const COUNT_PAGE_SIZE = 1;

/**
 * Live subscriptions only (11·F20). Sent explicitly so an older backend, which
 * lists cancelled ones too, counts the same as one that leaves them out.
 */
const LIVE_STATUS_FILTER = LIVE_SUBSCRIBER_STATUSES.join(',');

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

/** `GET /platform/plans/{id}/subscribers` — the live subscriber total only. */
export async function getSubscriberCount(planId: string): Promise<number> {
  const response = await platformApi.get(`/plans/${encodeURIComponent(planId)}/subscribers`, {
    params: { page_size: COUNT_PAGE_SIZE, status: LIVE_STATUS_FILTER },
  });
  return subscriberPageResponseSchema.parse(response.data).total;
}

/** `GET /platform/plans/{id}/subscribers` — one page of live subscribers, newest first. */
export async function getSubscribers(planId: string, page: number, pageSize: number) {
  const response = await platformApi.get(`/plans/${encodeURIComponent(planId)}/subscribers`, {
    params: { page, page_size: pageSize, status: LIVE_STATUS_FILTER, sort: '-started_at' },
  });
  return subscriberRowsPageSchema.parse(response.data);
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

/** `POST /platform/plans/{id}/unarchive` (BE-28): idempotent. */
export async function postPlanUnarchive(planId: string): Promise<PlanResponse> {
  const response = await platformApi.post(`/plans/${encodeURIComponent(planId)}/unarchive`);
  return planResponseSchema.parse(response.data);
}

/** The older backend's way back: `PATCH {is_active: true}` with If-Match. */
export async function patchPlanReactivate(planId: string, version: number): Promise<PlanResponse> {
  const body: PlanReactivateRequest = { is_active: true };
  const response = await platformApi.patch(`/plans/${encodeURIComponent(planId)}`, body, {
    headers: ifMatch(version),
  });
  return planResponseSchema.parse(response.data);
}
