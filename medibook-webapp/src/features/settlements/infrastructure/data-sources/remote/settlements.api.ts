import { readFileOrUrl, withJsonErrorBody, type FileOrUrl } from '@/core/api/blobResponses';
import { isFileStoreUrl } from '@/core/api/fileUrls';
import { hospitalApi } from '@/core/api/http';
import { MAX_PAGE_SIZE } from '@/core/api/pagination';
import { clientFailure } from '@/core/error/toFailure';

import type {
  PayoutListQuery,
  SettlementPeriodFilters,
  StatementListQuery,
} from '@/features/settlements/domain/entities/settlements.entities';
import {
  payoutPageResponseSchema,
  settlementPeriodDetailResponseSchema,
  settlementPeriodPageResponseSchema,
  statementPageResponseSchema,
} from '@/features/settlements/infrastructure/data-sources/remote/settlements.response';

/** Newest period first — the backend's default, restated so the window is deterministic. */
const PERIODS_SORT = '-period_start';

/** Statements are monthly: the newest month first, one row is enough. */
const STATEMENT_LOOKUP_SORT = '-period_start';

const OFF_STORE_LINK = 'The statement link does not point to the file store, so it was not opened.';

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

/**
 * `GET /hospital/settlements/periods/{id}` — period + breakdown, adjustments,
 * payout, and the statements of the months it overlaps.
 */
export async function getSettlementPeriod(periodId: string) {
  const response = await hospitalApi.get(`/settlements/periods/${encodeURIComponent(periodId)}`);
  return settlementPeriodDetailResponseSchema.parse(response.data);
}

/** `yyyy-mm-dd` → the first day of its month. */
export function monthStartOf(date: string): string {
  return `${date.slice(0, 'yyyy-mm'.length)}-01`;
}

/**
 * `GET /hospital/statements?date_from&date_to` — both bounds filter
 * `period_start`, and statements start on the 1st, so the month containing
 * `date` is the one statement starting between that 1st and `date` (UAT-29).
 */
export async function getStatementsForDate(date: string) {
  const response = await hospitalApi.get('/statements', {
    params: {
      date_from: monthStartOf(date),
      date_to: date,
      sort: STATEMENT_LOOKUP_SORT,
      page_size: 1,
    },
  });
  return statementPageResponseSchema.parse(response.data);
}

/**
 * `GET /hospital/statements` — one page of the monthly statements (Q99). The
 * server filters `period_start`, so the start bound moves back to its month's
 * 1st: a range starting 15 Sep still lists the September statement.
 */
export async function getStatements(query: StatementListQuery) {
  const params: Record<string, string | number> = {
    page: query.page,
    page_size: query.pageSize,
    sort: `${query.sortDirection === 'desc' ? '-' : ''}${query.sortField}`,
  };
  if (query.dateFrom) params.date_from = monthStartOf(query.dateFrom);
  if (query.dateTo) params.date_to = query.dateTo;
  const response = await hospitalApi.get('/statements', { params });
  return statementPageResponseSchema.parse(response.data);
}

/**
 * `GET /hospital/statements/{id}.pdf` — answers JSON `{url, expires_at,
 * statement_no}` with a 10-minute signed link (backend SET-02); an older
 * server sends the PDF bytes. Asked for as a blob so both arrive intact; a
 * 501 when the server cannot render keeps its own message.
 */
export async function getStatementPdf(statementId: string): Promise<FileOrUrl> {
  try {
    const response = await hospitalApi.get<Blob>(
      `/statements/${encodeURIComponent(statementId)}.pdf`,
      { responseType: 'blob' },
    );
    const answer = await readFileOrUrl(response.data);
    if (answer.kind === 'url' && !isFileStoreUrl(answer.url)) {
      throw clientFailure('forbidden', OFF_STORE_LINK);
    }
    return answer;
  } catch (error) {
    throw await withJsonErrorBody(error);
  }
}

/** `GET /hospital/settlements/payouts` — one page of the hospital's own payouts. */
export async function getPayouts(query: PayoutListQuery) {
  const params: Record<string, string | number> = {
    page: query.page,
    page_size: query.pageSize,
    sort: `${query.sortDirection === 'desc' ? '-' : ''}${query.sortField}`,
  };
  if (query.status) params.status = query.status;
  const response = await hospitalApi.get('/settlements/payouts', { params });
  return payoutPageResponseSchema.parse(response.data);
}
