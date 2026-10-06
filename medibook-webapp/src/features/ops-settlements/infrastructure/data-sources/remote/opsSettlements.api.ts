import type { z } from 'zod';
import { clientFailure } from '@/core/error/toFailure';

import { idempotencyKey } from '@/core/api/headers';
import { platformApi } from '@/core/api/http';
import { MAX_PAGE_SIZE, paginatedSchema, fetchCappedPages } from '@/core/api/pagination';

import type { PeriodFilter } from '@/features/ops-settlements/domain/entities/opsSettlements.entities';
import type {
  PayoutReleaseRequest,
  PayoutRunCreateRequest,
  PayoutRunReleaseRequest,
} from '@/features/ops-settlements/infrastructure/data-sources/remote/opsSettlements.request';
import {
  payoutResponseSchema,
  payoutRunDetailResponseSchema,
  payoutRunPageResponseSchema,
  payoutRunResponseSchema,
  periodPageResponseSchema,
  type PayoutResponse,
  type PayoutRunDetailResponse,
  type PayoutRunResponse,
  type PeriodResponse,
} from '@/features/ops-settlements/infrastructure/data-sources/remote/opsSettlements.response';

/**
 * Hard stop for the page walk: 50 pages of `MAX_PAGE_SIZE` rows is far more
 * than one filtered settlement view holds, so it only trips on a backend that
 * keeps answering `has_next: true`.
 */
const MAX_PAGES = 50;

const LIST_TOO_LONG = 'This list is too long to load in full. Narrow it down and try again.';

/** Every page of a list; the queue groups, filters and totals the whole set on the client. */
async function getAllPages<T extends z.ZodType>(
  path: string,
  pageSchema: ReturnType<typeof paginatedSchema<T>>,
  params: Readonly<Record<string, string>> = {},
): Promise<z.infer<T>[]> {
  const { rows, truncated } = await fetchCappedPages(async (page) => {
    const response = await platformApi.get(path, {
      params: { ...params, page, page_size: MAX_PAGE_SIZE },
    });
    return pageSchema.parse(response.data);
  }, MAX_PAGES);
  // The screen totals and filters the whole set, so a partial list would
  // mislead: say so instead of silently dropping rows (DATA-07).
  if (truncated) throw clientFailure('unknown', LIST_TOO_LONG);
  return rows;
}

export function getPeriods(filter: PeriodFilter): Promise<PeriodResponse[]> {
  const params: Record<string, string> = { status: filter.statuses.join(',') };
  if (filter.dateFrom) params.date_from = filter.dateFrom;
  if (filter.dateTo) params.date_to = filter.dateTo;
  if (filter.hospitalId) params.hospital_id = filter.hospitalId;
  return getAllPages('/settlements/periods', periodPageResponseSchema, params);
}

export function getPayoutRuns(): Promise<PayoutRunResponse[]> {
  return getAllPages('/settlements/payout-runs', payoutRunPageResponseSchema);
}

export async function getPayoutRun(runId: string): Promise<PayoutRunDetailResponse> {
  const response = await platformApi.get(`/settlements/payout-runs/${encodeURIComponent(runId)}`);
  return payoutRunDetailResponseSchema.parse(response.data);
}

export async function postPayoutRun(
  body: PayoutRunCreateRequest,
  replayKey: string,
): Promise<PayoutRunResponse> {
  const response = await platformApi.post('/settlements/payout-runs', body, {
    headers: idempotencyKey(replayKey),
  });
  return payoutRunResponseSchema.parse(response.data);
}

export async function postPayoutRunApprove(runId: string): Promise<PayoutRunDetailResponse> {
  const response = await platformApi.post(
    `/settlements/payout-runs/${encodeURIComponent(runId)}/approve`,
  );
  return payoutRunDetailResponseSchema.parse(response.data);
}

export async function postPayoutRunRelease(
  runId: string,
  body: PayoutRunReleaseRequest,
  replayKey: string,
): Promise<PayoutRunDetailResponse> {
  const response = await platformApi.post(
    `/settlements/payout-runs/${encodeURIComponent(runId)}/release`,
    body,
    {
      headers: idempotencyKey(replayKey),
    },
  );
  return payoutRunDetailResponseSchema.parse(response.data);
}

export async function postPayoutRelease(
  payoutId: string,
  body: PayoutReleaseRequest,
  replayKey: string,
): Promise<PayoutResponse> {
  const response = await platformApi.post(
    `/settlements/payouts/${encodeURIComponent(payoutId)}/release`,
    body,
    {
      headers: idempotencyKey(replayKey),
    },
  );
  return payoutResponseSchema.parse(response.data);
}
