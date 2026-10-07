import type { z } from 'zod';

import { idempotencyKey } from '@/core/api/headers';
import { platformApi } from '@/core/api/http';
import { MAX_PAGE_SIZE, paginatedSchema } from '@/core/api/pagination';

import type {
  PayoutCommand,
  PayoutFilter,
  PeriodFilter,
  SettlementExportFormat,
  StatementListParams,
} from '@/features/ops-settlements/domain/entities/opsSettlements.entities';
import type {
  AdjustmentCreateRequest,
  PayoutReasonRequest,
  PayoutReleaseRequest,
  PayoutRunCreateRequest,
  PayoutRunReleaseRequest,
  PeriodCloseBody,
  StatementIssueRequest,
} from '@/features/ops-settlements/infrastructure/data-sources/remote/opsSettlements.request';
import {
  adjustmentResponseSchema,
  payoutPageResponseSchema,
  payoutResponseSchema,
  payoutRunCreatedResponseSchema,
  payoutRunDetailResponseSchema,
  payoutRunPageResponseSchema,
  periodCloseResponseSchema,
  periodDetailResponseSchema,
  periodPageResponseSchema,
  statementIssueResponseSchema,
  statementPageResponseSchema,
  statementPdfLinkSchema,
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

/** Every page of a list; the queue groups, filters and totals the whole set on the client. */
async function getAllPages<T extends z.ZodType>(
  path: string,
  pageSchema: ReturnType<typeof paginatedSchema<T>>,
  params: Readonly<Record<string, string>> = {},
): Promise<z.infer<T>[]> {
  const rows: z.infer<T>[] = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const response = await platformApi.get(path, {
      params: { ...params, page, page_size: MAX_PAGE_SIZE },
    });
    const body = pageSchema.parse(response.data);
    rows.push(...body.results);
    if (!body.has_next) break;
  }
  return rows;
}

/** The period list's filters, shared by the list and its export. */
function periodParams(filter: PeriodFilter): Record<string, string> {
  const params: Record<string, string> = { status: filter.statuses.join(',') };
  if (filter.dateFrom) params.date_from = filter.dateFrom;
  if (filter.dateTo) params.date_to = filter.dateTo;
  if (filter.hospitalId) params.hospital_id = filter.hospitalId;
  return params;
}

export function getPeriods(filter: PeriodFilter): Promise<PeriodResponse[]> {
  return getAllPages('/settlements/periods', periodPageResponseSchema, periodParams(filter));
}

/** `GET /platform/settlements/periods/{id}` — breakdown, adjustments, payout, statements. */
export async function getPeriod(periodId: string) {
  const response = await platformApi.get(`/settlements/periods/${encodeURIComponent(periodId)}`);
  return periodDetailResponseSchema.parse(response.data);
}

/**
 * `POST /platform/settlements/periods/close`. `confirm: false` is the dry run
 * (`?dry_run=true`); `confirm: true` closes (`?dry_run=false`).
 */
export async function postPeriodClose(body: PeriodCloseBody, confirm: boolean) {
  const response = await platformApi.post('/settlements/periods/close', body, {
    params: { dry_run: confirm ? 'false' : 'true' },
  });
  return periodCloseResponseSchema.parse(response.data);
}

/** `POST /platform/settlements/adjustments` · Idempotency-Key. */
export async function postAdjustment(body: AdjustmentCreateRequest, replayKey: string) {
  const response = await platformApi.post('/settlements/adjustments', body, {
    headers: idempotencyKey(replayKey),
  });
  return adjustmentResponseSchema.parse(response.data);
}

export function getPayoutRuns(): Promise<PayoutRunResponse[]> {
  return getAllPages('/settlements/payout-runs', payoutRunPageResponseSchema);
}

export async function getPayoutRun(runId: string): Promise<PayoutRunDetailResponse> {
  const response = await platformApi.get(`/settlements/payout-runs/${encodeURIComponent(runId)}`);
  return payoutRunDetailResponseSchema.parse(response.data);
}

/** `GET /platform/settlements/payouts` — every payout across runs in one list (BE-27). */
export function getPayouts(filter: PayoutFilter): Promise<PayoutResponse[]> {
  const params: Record<string, string> = {};
  if (filter.hospitalId) params.hospital_id = filter.hospitalId;
  return getAllPages('/settlements/payouts', payoutPageResponseSchema, params);
}

export async function postPayoutRun(body: PayoutRunCreateRequest, replayKey: string) {
  const response = await platformApi.post('/settlements/payout-runs', body, {
    headers: idempotencyKey(replayKey),
  });
  return payoutRunCreatedResponseSchema.parse(response.data);
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

/** `POST /platform/settlements/payouts/{id}/hold|fail {reason}` · Idempotency-Key. */
export async function postPayoutCommand(
  payoutId: string,
  command: PayoutCommand,
  body: PayoutReasonRequest,
  replayKey: string,
): Promise<PayoutResponse> {
  const response = await platformApi.post(
    `/settlements/payouts/${encodeURIComponent(payoutId)}/${command}`,
    body,
    { headers: idempotencyKey(replayKey) },
  );
  return payoutResponseSchema.parse(response.data);
}

/** `GET /platform/statements` (billing.view), newest month first. */
export async function getStatements(params: StatementListParams) {
  const response = await platformApi.get('/statements', {
    params: {
      page: params.page,
      page_size: params.pageSize,
      ...(params.hospitalId ? { hospital_id: params.hospitalId } : {}),
      ...(params.dateFrom ? { date_from: params.dateFrom } : {}),
      ...(params.dateTo ? { date_to: params.dateTo } : {}),
    },
  });
  return statementPageResponseSchema.parse(response.data);
}

/** `POST /platform/statements/issue {period: 'YYYY-MM'}` · Idempotency-Key (billing.edit). */
export async function postStatementIssue(body: StatementIssueRequest, replayKey: string) {
  const response = await platformApi.post('/statements/issue', body, {
    headers: idempotencyKey(replayKey),
  });
  return statementIssueResponseSchema.parse(response.data);
}

/**
 * `GET /platform/statements/{id}.pdf`. SET-02 answers JSON `{url, …}` (a
 * signed link); an older backend sends the PDF itself. Read as a blob and
 * tell the two apart by type.
 */
export async function getStatementPdf(
  statementId: string,
): Promise<{ readonly url: string } | { readonly blob: Blob }> {
  const response = await platformApi.get<Blob>(
    `/statements/${encodeURIComponent(statementId)}.pdf`,
    { responseType: 'blob' },
  );
  const blob = response.data;
  if (blob.type.includes('json')) {
    const link = statementPdfLinkSchema.parse(JSON.parse(await blob.text()));
    return { url: link.url };
  }
  return { blob };
}

/** `GET /platform/settlements/export.{csv|xlsx|pdf}` — the period list's filters. */
export async function getSettlementsExport(
  format: SettlementExportFormat,
  filter: PeriodFilter,
): Promise<Blob> {
  const response = await platformApi.get<Blob>(`/settlements/export.${format}`, {
    params: periodParams(filter),
    responseType: 'blob',
  });
  return response.data;
}
