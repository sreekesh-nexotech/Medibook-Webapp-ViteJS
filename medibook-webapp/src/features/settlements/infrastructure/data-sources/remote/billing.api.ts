import { isAxiosError } from 'axios';

import { withJsonErrorBody } from '@/core/api/blobResponses';
import { hospitalApi } from '@/core/api/http';
import { MAX_PAGE_SIZE } from '@/core/api/pagination';

import type { PlanChangeInput } from '@/features/settlements/domain/entities/billing.entities';
import {
  billingPlanPageResponseSchema,
  creditNotePageResponseSchema,
  invoiceDetailResponseSchema,
  invoicePageResponseSchema,
  planChangeRequestPageResponseSchema,
  planChangeRequestResponseSchema,
  subscriptionResponseSchema,
  usageResponseSchema,
} from '@/features/settlements/infrastructure/data-sources/remote/billing.response';

/** `GET /hospital/billing/subscription` — current plan, status and period. */
export async function getSubscription() {
  const response = await hospitalApi.get('/billing/subscription');
  return subscriptionResponseSchema.parse(response.data);
}

/** `GET /hospital/billing/usage` — users / doctors / storage against plan limits. */
export async function getUsage() {
  const response = await hospitalApi.get('/billing/usage');
  return usageResponseSchema.parse(response.data);
}

/** `GET /hospital/billing/invoices` — newest first. */
export async function getInvoices(page: number, pageSize: number) {
  const response = await hospitalApi.get('/billing/invoices', {
    params: { page, page_size: pageSize },
  });
  return invoicePageResponseSchema.parse(response.data);
}

/** `GET /hospital/billing/invoices/{id}` — lines plus the frozen party snapshots. */
export async function getInvoice(invoiceId: string) {
  const response = await hospitalApi.get(`/billing/invoices/${encodeURIComponent(invoiceId)}`);
  return invoiceDetailResponseSchema.parse(response.data);
}

/**
 * `GET /hospital/billing/invoices/{id}.pdf` — the bytes; 501 when this server
 * cannot render PDFs, whose JSON message is decoded from the blob body
 * (appendix 09 F8).
 */
export async function getInvoicePdf(invoiceId: string): Promise<Blob> {
  try {
    const response = await hospitalApi.get<Blob>(
      `/billing/invoices/${encodeURIComponent(invoiceId)}.pdf`,
      { responseType: 'blob' },
    );
    return response.data;
  } catch (error) {
    throw await withJsonErrorBody(error);
  }
}

/** `GET /hospital/billing/plans` — the public, active catalogue (one page holds it all). */
export async function getPlans() {
  const response = await hospitalApi.get('/billing/plans', {
    params: { page_size: MAX_PAGE_SIZE },
  });
  return billingPlanPageResponseSchema.parse(response.data);
}

/**
 * `GET /hospital/billing/plan-change-requests` — newest first; needs
 * `billing_settlements.edit` on the hospital side.
 */
export async function getPlanChangeRequests() {
  const response = await hospitalApi.get('/billing/plan-change-requests');
  return planChangeRequestPageResponseSchema.parse(response.data);
}

/** `POST /hospital/billing/plan-change-requests` — Medibook operations review it. */
export async function postPlanChangeRequest(input: PlanChangeInput) {
  const response = await hospitalApi.post('/billing/plan-change-requests', {
    to_plan_id: input.toPlanId,
    to_billing_period: input.toBillingPeriod,
    note: input.note,
  });
  return planChangeRequestResponseSchema.parse(response.data);
}

const HTTP_NOT_FOUND = 404;

/**
 * `GET /hospital/billing/credit-notes` — the newest 100, newest first
 * (backend B4, M-25). A server without the route answers 404: no credit
 * notes, not an error.
 */
export async function getCreditNotes() {
  try {
    const response = await hospitalApi.get('/billing/credit-notes', {
      params: { page_size: MAX_PAGE_SIZE, sort: '-issued_at' },
    });
    return creditNotePageResponseSchema.parse(response.data);
  } catch (error) {
    if (isAxiosError(error) && error.response?.status === HTTP_NOT_FOUND) return null;
    throw error;
  }
}
