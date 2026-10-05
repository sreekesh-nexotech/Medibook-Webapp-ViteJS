import { z } from 'zod';

import { hospitalApi } from '@/core/api/http';
import { MAX_PAGE_SIZE } from '@/core/api/pagination';

import type {
  PaymentFilters,
  PaymentPageQuery,
} from '@/features/payments/domain/entities/payments.entities';
import type {
  PaymentDetailResponse,
  PaymentLineResponse,
  VisitReceiptPageResponse,
} from '@/features/payments/infrastructure/data-sources/remote/payments.response';
import {
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
    ...(f.status && { status: f.status }),
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
  const response = await hospitalApi.get(`${PAYMENTS_PATH}/${paymentId}`);
  return paymentDetailResponseSchema.parse(response.data);
}

export async function listVisitReceipts(visitId: string): Promise<VisitReceiptPageResponse> {
  const response = await hospitalApi.get(`/visits/${visitId}/receipts`, {
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
