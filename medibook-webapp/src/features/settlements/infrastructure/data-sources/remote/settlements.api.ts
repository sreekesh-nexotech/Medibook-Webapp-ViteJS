import { hospitalApi } from '@/core/api/http';
import { MAX_PAGE_SIZE } from '@/core/api/pagination';

import type { SettlementPeriodFilters } from '@/features/settlements/domain/entities/settlements.entities';
import {
  settlementPeriodDetailResponseSchema,
  settlementPeriodPageResponseSchema,
  statementPageResponseSchema,
} from '@/features/settlements/infrastructure/data-sources/remote/settlements.response';

/** Newest period first — the backend's default, restated so the window is deterministic. */
const PERIODS_SORT = '-period_start';

/** `GET /hospital/settlements/periods` — the latest page of up to 100 periods. */
export async function getSettlementPeriods(filters: SettlementPeriodFilters) {
  const params: Record<string, string | number> = {
    sort: PERIODS_SORT,
    page_size: MAX_PAGE_SIZE,
  };
  if (filters.dateFrom) params.date_from = filters.dateFrom;
  if (filters.dateTo) params.date_to = filters.dateTo;
  const response = await hospitalApi.get('/settlements/periods', { params });
  return settlementPeriodPageResponseSchema.parse(response.data);
}

/** `GET /hospital/settlements/periods/{id}` — period + breakdown, adjustments, payout. */
export async function getSettlementPeriod(periodId: string) {
  const response = await hospitalApi.get(`/settlements/periods/${encodeURIComponent(periodId)}`);
  return settlementPeriodDetailResponseSchema.parse(response.data);
}

/**
 * `GET /hospital/statements?date_from=d&date_to=d` — statements whose
 * `period_start` is exactly `d` (both bounds filter `period_start`).
 */
export async function getStatementsStartingOn(periodStart: string) {
  const response = await hospitalApi.get('/statements', {
    params: { date_from: periodStart, date_to: periodStart },
  });
  return statementPageResponseSchema.parse(response.data);
}

/** `GET /hospital/statements/{id}.pdf` — renders on demand (501 when this server cannot). */
export async function getStatementPdf(statementId: string): Promise<Blob> {
  const response = await hospitalApi.get<Blob>(
    `/statements/${encodeURIComponent(statementId)}.pdf`,
    {
      responseType: 'blob',
    },
  );
  return response.data;
}
