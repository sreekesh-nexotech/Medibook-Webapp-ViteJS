import { z } from 'zod';

import { hospitalApi } from '@/core/api/http';
import { MAX_PAGE_SIZE, fetchAllPages } from '@/core/api/pagination';

import type {
  PaymentFilters,
  PaymentPageQuery,
} from '@/features/payments/domain/entities/payments.entities';
import type {
  CashSessionResponse,
  PaymentDetailResponse,
  PaymentLineResponse,
  VisitReceiptPageResponse,
} from '@/features/payments/infrastructure/data-sources/remote/payments.response';
import {
  cashSessionPageResponseSchema,
  cashSessionResponseSchema,
  paymentDetailResponseSchema,
  paymentPageResponseSchema,
  visitReceiptPageResponseSchema,
} from '@/features/payments/infrastructure/data-sources/remote/payments.response';

/** Payments endpoints (`/api/v1/hospital/…`). Every body is Zod-validated. */

const PAYMENTS_PATH = '/payments';
const EXPORT_CSV_PATH = '/payments/export.csv';

/** Day totals read every page; past this the figures would be partial, so stop. */
const MAX_TOTAL_PAGES = 20;

/** Filters → the allowlisted query params (`hospital_payment_list.FILTERS`). */
function filterParams(f: PaymentFilters): Readonly<Record<string, string>> {
  return {
    date_from: f.dateFrom,
    date_to: f.dateTo,
    // `status` takes several values, comma-separated (`FilterSpec` `many=True`).
    ...(f.statuses.length > 0 && { status: f.statuses.join(',') }),
    ...(f.method && { method: f.method }),
    ...(f.doctorId && { doctor_id: f.doctorId }),
    ...(f.departmentId && { department_id: f.departmentId }),
    ...(f.q.trim() && { q: f.q.trim() }),
  };
}

export async function listPayments(query: PaymentPageQuery) {
  const response = await hospitalApi.get(PAYMENTS_PATH, {
    params: { ...filterParams(query), page: query.page, page_size: query.pageSize },
  });
  return paymentPageResponseSchema.parse(response.data);
}

export async function listAllPayments(filters: PaymentFilters): Promise<PaymentLineResponse[]> {
  const out: PaymentLineResponse[] = [];
  for (let page = 1; page <= MAX_TOTAL_PAGES; page += 1) {
    const response = await hospitalApi.get(PAYMENTS_PATH, {
      params: { ...filterParams(filters), page, page_size: MAX_PAGE_SIZE },
    });
    const parsed = paymentPageResponseSchema.parse(response.data);
    out.push(...parsed.results);
    if (!parsed.has_next) break;
  }
  return out;
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

export async function exportPaymentsCsv(filters: PaymentFilters): Promise<string> {
  const response = await hospitalApi.get(EXPORT_CSV_PATH, {
    params: filterParams(filters),
    responseType: 'text',
  });
  return z.string().parse(response.data);
}

/* ------------------------------------------------------------ cash sessions */

const CASH_SESSIONS_PATH = '/cash-sessions';

/** `staffId`'s open drawer — at most one exists (`uq_open_session`). */
export async function getOpenCashSession(staffId: string): Promise<CashSessionResponse | null> {
  const response = await hospitalApi.get(CASH_SESSIONS_PATH, {
    params: { status: 'open', staff_id: staffId, page_size: 1 },
  });
  return cashSessionPageResponseSchema.parse(response.data).results[0] ?? null;
}

export async function postCashSession(
  openingFloatPaise: number,
  counterId: string | null,
): Promise<CashSessionResponse> {
  const response = await hospitalApi.post(CASH_SESSIONS_PATH, {
    opening_float_paise: openingFloatPaise,
    ...(counterId ? { counter_id: counterId } : {}),
  });
  return cashSessionResponseSchema.parse(response.data);
}

export async function postCloseCashSession(
  id: string,
  countedCashPaise: number,
  note: string | null,
): Promise<CashSessionResponse> {
  const response = await hospitalApi.post(`${CASH_SESSIONS_PATH}/${encodeURIComponent(id)}/close`, {
    counted_cash_paise: countedCashPaise,
    note,
  });
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

export async function postReconcileCashSession(id: string): Promise<CashSessionResponse> {
  const response = await hospitalApi.post(
    `${CASH_SESSIONS_PATH}/${encodeURIComponent(id)}/reconcile`,
  );
  return cashSessionResponseSchema.parse(response.data);
}
