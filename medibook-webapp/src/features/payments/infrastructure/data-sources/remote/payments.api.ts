import { exportTruncation, withJsonErrorBody } from '@/core/api/blobResponses';
import { idempotencyKey, ifMatch } from '@/core/api/headers';
import { hospitalApi } from '@/core/api/http';
import { MAX_PAGE_SIZE, fetchAllPages } from '@/core/api/pagination';
import { isUnknownQueryParam, withQueryParamFallback } from '@/core/api/queryParams';
import { clientFailure } from '@/core/error/toFailure';

import type {
  CashWriteGuard,
  PaymentExportFormat,
  PaymentFilters,
  PaymentPageQuery,
  RefundListQuery,
} from '@/features/payments/domain/entities/payments.entities';
import type {
  CashSessionResponse,
  CashSummaryResponse,
  CounterPageResponse,
  PaymentDetailResponse,
  PaymentLineResponse,
  PaymentPageResponse,
  RefundPageResponse,
  RefundResponse,
  VisitReceiptPageResponse,
} from '@/features/payments/infrastructure/data-sources/remote/payments.response';
import {
  cashSessionPageResponseSchema,
  cashSessionResponseSchema,
  cashSummaryResponseSchema,
  counterPageResponseSchema,
  paymentDetailResponseSchema,
  paymentPageResponseSchema,
  refundCreatedResponseSchema,
  refundPageResponseSchema,
  visitReceiptPageResponseSchema,
} from '@/features/payments/infrastructure/data-sources/remote/payments.response';

/** Payments endpoints (`/api/v1/hospital/…`). Every body is Zod-validated. */

const PAYMENTS_PATH = '/payments';
const REFUNDS_PATH = '/refunds';
const CASH_SESSIONS_PATH = '/cash-sessions';

/** The server builds each export; the list's filters apply to all three. */
const EXPORT_PATHS = {
  csv: '/payments/export.csv',
  xlsx: '/payments/export.xlsx',
  pdf: '/payments/export.pdf',
} as const;

/** Filters the backend adds in the fix wave (B3); older backends refuse them as unknown. */
const CHANNEL_PARAM = 'channel';
const ORDER_PARAM = 'order_id';
const CASH_SESSION_PARAM = 'cash_session_id';

const CASH_METHOD = 'cash';

const CHANNEL_EXPORT_UNSUPPORTED =
  'This server cannot limit an export to one source yet. Set the source to All and export again.';

/** Filters → the allowlisted query params (`hospital_payment_list.FILTERS`). */
function filterParams(f: PaymentFilters, withChannel = true): Record<string, string> {
  return {
    date_from: f.dateFrom,
    date_to: f.dateTo,
    // `status` takes several values, comma-separated (`FilterSpec` `many=True`).
    ...(f.statuses.length > 0 && { status: f.statuses.join(',') }),
    ...(f.method && { method: f.method }),
    ...(withChannel && f.channel && { [CHANNEL_PARAM]: f.channel }),
    ...(f.doctorId && { doctor_id: f.doctorId }),
    ...(f.departmentId && { department_id: f.departmentId }),
    ...(f.q.trim() && { q: f.q.trim() }),
  };
}

function sortParam(query: PaymentPageQuery): string {
  return query.sortDirection === 'desc' ? `-${query.sortField}` : query.sortField;
}

async function getPaymentPage(params: Record<string, string | number>) {
  const response = await hospitalApi.get(PAYMENTS_PATH, { params });
  return paymentPageResponseSchema.parse(response.data);
}

/** A page of lines, and whether the channel filter was applied by the server. */
export interface PaymentListResult {
  readonly dto: PaymentPageResponse;
  readonly isChannelFiltered: boolean;
}

/**
 * One page of lines. A channel filter the backend does not know yet is
 * dropped and reported (`isChannelFiltered: false`), so the screen can narrow
 * the page itself.
 */
export async function listPayments(query: PaymentPageQuery): Promise<PaymentListResult> {
  const params = (withChannel: boolean) => ({
    ...filterParams(query, withChannel),
    sort: sortParam(query),
    page: query.page,
    page_size: query.pageSize,
  });
  if (!query.channel) return { dto: await getPaymentPage(params(false)), isChannelFiltered: true };
  return withQueryParamFallback<PaymentListResult>(
    CHANNEL_PARAM,
    async () => ({ dto: await getPaymentPage(params(true)), isChannelFiltered: true }),
    async () => ({ dto: await getPaymentPage(params(false)), isChannelFiltered: false }),
  );
}

/** Every line matching `filters`, all pages (fails loudly past the paging cap). */
export async function listAllPayments(filters: PaymentFilters): Promise<PaymentLineResponse[]> {
  return fetchAllPages((page) => getPaymentPage({ ...filterParams(filters), ...page }));
}

/**
 * Every line of one payment order: the exact `order_id` filter (B3), or on an
 * older backend the booking-reference search narrowed to the order here.
 */
export async function listOrderLines(
  orderId: string,
  bookingRef: string | null,
): Promise<PaymentLineResponse[]> {
  const rows = await withQueryParamFallback(
    ORDER_PARAM,
    () => fetchAllPages((page) => getPaymentPage({ [ORDER_PARAM]: orderId, ...page })),
    () =>
      bookingRef
        ? fetchAllPages((page) => getPaymentPage({ q: bookingRef, ...page }))
        : Promise.resolve([]),
  );
  return rows.filter((row) => row.order_id === orderId);
}

export async function getPaymentDetail(paymentId: string): Promise<PaymentDetailResponse> {
  const response = await hospitalApi.get(`${PAYMENTS_PATH}/${encodeURIComponent(paymentId)}`);
  return paymentDetailResponseSchema.parse(response.data);
}

export async function listVisitReceipts(visitId: string): Promise<VisitReceiptPageResponse> {
  const response = await hospitalApi.get(`/visits/${encodeURIComponent(visitId)}/receipts`, {
    params: { page_size: MAX_PAGE_SIZE },
  });
  return visitReceiptPageResponseSchema.parse(response.data);
}

/** The file plus what its headers say about rows left out (UAT-40). */
export async function exportPayments(filters: PaymentFilters, format: PaymentExportFormat) {
  try {
    const response = await hospitalApi.get<Blob>(EXPORT_PATHS[format], {
      params: filterParams(filters),
      responseType: 'blob',
    });
    return { blob: response.data, truncation: exportTruncation(response.headers) };
  } catch (error) {
    const decoded = await withJsonErrorBody(error);
    if (isUnknownQueryParam(decoded, CHANNEL_PARAM)) {
      throw clientFailure('validation', CHANNEL_EXPORT_UNSUPPORTED);
    }
    throw decoded;
  }
}

/* ------------------------------------------------------------------ refunds */

function refundParams(query: Omit<RefundListQuery, 'page' | 'pageSize'>): Record<string, string> {
  return {
    date_from: query.dateFrom,
    date_to: query.dateTo,
    ...(query.statuses.length > 0 && { status: query.statuses.join(',') }),
    ...(query.method && { method: query.method }),
  };
}

async function getRefundPage(params: Record<string, string | number>) {
  const response = await hospitalApi.get(REFUNDS_PATH, { params });
  return refundPageResponseSchema.parse(response.data);
}

/** One page of refunds, newest request first. */
export async function listRefunds(query: RefundListQuery): Promise<RefundPageResponse> {
  return getRefundPage({
    ...refundParams(query),
    sort: '-requested_at',
    page: query.page,
    page_size: query.pageSize,
  });
}

/** Every refund requested in a hospital-local date window. */
export async function listAllRefunds(dateFrom: string, dateTo: string): Promise<RefundResponse[]> {
  return fetchAllPages((page) =>
    getRefundPage({ ...refundParams({ dateFrom, dateTo, statuses: [], method: null }), ...page }),
  );
}

/**
 * `POST /appointments/{id}/refunds {reason}` — full only, one refund per
 * captured line of the paid order (Q94, Q95). Replay-safe on the caller's key.
 */
export async function postRefund(
  appointmentId: string,
  reason: string,
  key: string,
): Promise<RefundResponse[]> {
  const response = await hospitalApi.post(
    `/appointments/${encodeURIComponent(appointmentId)}/refunds`,
    { reason },
    { headers: idempotencyKey(key) },
  );
  return refundCreatedResponseSchema.parse(response.data).results;
}

/* ------------------------------------------------------------ cash sessions */

/** The day's cash (`cash_desk.view`); no `date` = hospital-local today (F26). */
export async function getCashSummary(date: string | null): Promise<CashSummaryResponse> {
  const response = await hospitalApi.get(`${CASH_SESSIONS_PATH}/summary`, {
    params: date ? { date } : undefined,
  });
  return cashSummaryResponseSchema.parse(response.data);
}

/** `staffId`'s open drawer — at most one exists (`uq_open_session`). */
export async function getOpenCashSession(staffId: string): Promise<CashSessionResponse | null> {
  const response = await hospitalApi.get(CASH_SESSIONS_PATH, {
    params: { status: 'open', staff_id: staffId, page_size: 1 },
  });
  return cashSessionPageResponseSchema.parse(response.data).results[0] ?? null;
}

/** The hospital's counters (`GET /counters`, readable with `cash_desk.add`, B2). */
export async function listCounters(): Promise<CounterPageResponse['results']> {
  return fetchAllPages(async (page) => {
    const response = await hospitalApi.get('/counters', { params: page });
    return counterPageResponseSchema.parse(response.data);
  });
}

export async function postCashSession(
  openingFloatPaise: number,
  counterId: string | null,
  key: string,
): Promise<CashSessionResponse> {
  const response = await hospitalApi.post(
    CASH_SESSIONS_PATH,
    {
      opening_float_paise: openingFloatPaise,
      ...(counterId ? { counter_id: counterId } : {}),
    },
    { headers: idempotencyKey(key) },
  );
  return cashSessionResponseSchema.parse(response.data);
}

/** `If-Match` when the drawer has a version (B2), and always a replay key. */
function guardHeaders(guard: CashWriteGuard): Record<string, string> {
  return {
    ...(guard.version === null ? {} : ifMatch(guard.version)),
    ...idempotencyKey(guard.idempotencyKey),
  };
}

export async function postCloseCashSession(
  id: string,
  countedCashPaise: number,
  note: string | null,
  guard: CashWriteGuard,
): Promise<CashSessionResponse> {
  const response = await hospitalApi.post(
    `${CASH_SESSIONS_PATH}/${encodeURIComponent(id)}/close`,
    { counted_cash_paise: countedCashPaise, note },
    { headers: guardHeaders(guard) },
  );
  return cashSessionResponseSchema.parse(response.data);
}

/** Every closed drawer (any staff, any day), oldest first. */
export async function listClosedCashSessions(): Promise<CashSessionResponse[]> {
  return fetchAllPages(async (params) => {
    const response = await hospitalApi.get(CASH_SESSIONS_PATH, {
      params: { ...params, status: 'closed', sort: 'closed_at' },
    });
    return cashSessionPageResponseSchema.parse(response.data);
  });
}

/** Reconcile, with the cash found in an uncounted drawer and a note (B2 / BE-23). */
export async function postReconcileCashSession(
  id: string,
  countedCashPaise: number | null,
  note: string | null,
  guard: CashWriteGuard,
): Promise<CashSessionResponse> {
  const response = await hospitalApi.post(
    `${CASH_SESSIONS_PATH}/${encodeURIComponent(id)}/reconcile`,
    {
      ...(countedCashPaise === null ? {} : { counted_cash_paise: countedCashPaise }),
      ...(note ? { note } : {}),
    },
    { headers: guardHeaders(guard) },
  );
  return cashSessionResponseSchema.parse(response.data);
}

/**
 * The cash lines that went into one drawer: the exact `cash_session_id`
 * filter (B3), or on an older backend the day's cash lines narrowed here.
 */
export async function listCashSessionPayments(
  sessionId: string,
  businessDate: string,
): Promise<PaymentLineResponse[]> {
  const rows = await withQueryParamFallback(
    CASH_SESSION_PARAM,
    () => fetchAllPages((page) => getPaymentPage({ [CASH_SESSION_PARAM]: sessionId, ...page })),
    () =>
      fetchAllPages((page) =>
        getPaymentPage({
          method: CASH_METHOD,
          date_from: businessDate,
          date_to: businessDate,
          ...page,
        }),
      ),
  );
  return rows.filter((row) => row.cash_session_id === sessionId);
}

/** The cash refunds handed back from one drawer, the same way. */
export async function listCashSessionRefunds(
  sessionId: string,
  businessDate: string,
): Promise<RefundResponse[]> {
  const rows = await withQueryParamFallback(
    CASH_SESSION_PARAM,
    () => fetchAllPages((page) => getRefundPage({ [CASH_SESSION_PARAM]: sessionId, ...page })),
    () =>
      fetchAllPages((page) =>
        getRefundPage({
          method: CASH_METHOD,
          date_from: businessDate,
          date_to: businessDate,
          ...page,
        }),
      ),
  );
  return rows.filter((row) => row.cash_session_id === sessionId);
}
