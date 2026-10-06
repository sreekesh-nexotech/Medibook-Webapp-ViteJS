import { hospitalApi } from '@/core/api/http';
import { MAX_PAGE_SIZE } from '@/core/api/pagination';

import type { PlanChangeInput } from '@/features/settlements/domain/entities/billing.entities';
import {
  billingPlanPageResponseSchema,
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

/** `GET /hospital/billing/invoices/{id}.pdf` — 501 when this server cannot render PDFs. */
export async function getInvoicePdf(invoiceId: string): Promise<Blob> {
  const response = await hospitalApi.get<Blob>(
    `/billing/invoices/${encodeURIComponent(invoiceId)}.pdf`,
    {
      responseType: 'blob',
    },
  );
  return response.data;
}

/** `GET /hospital/billing/plans` — the public, active catalogue (one page holds it all). */
export async function getPlans() {
  const response = await hospitalApi.get('/billing/plans', {
    params: { page_size: MAX_PAGE_SIZE },
  });
  return billingPlanPageResponseSchema.parse(response.data);
}

/** `GET /hospital/billing/plan-change-requests` — newest first; needs `billing_settlements.edit`. */
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
