import { idempotencyKey, ifMatch } from '@/core/api/headers';
import { platformApi } from '@/core/api/http';

import type {
  BillingPeriod,
  DunningListParams,
  InvoiceListParams,
  MarkPaidInput,
  PaymentListParams,
  PlanChangeListParams,
  SubscriptionChange,
  SubscriptionListParams,
} from '@/features/ops-billing/domain/entities/billing.entities';
import {
  billingSummarySchema,
  dunningPageSchema,
  invoiceDetailSchema,
  invoicePageSchema,
  invoiceSchema,
  paymentPageSchema,
  paymentSchema,
  planChangeApproveSchema,
  planChangePageSchema,
  planChangeSchema,
  prorationPreviewSchema,
  subscriptionChangeSchema,
  subscriptionPageSchema,
  subscriptionSchema,
} from '@/features/ops-billing/infrastructure/data-sources/remote/billing.response';

/** `/platform/billing/…` (`subscriptions/routes/platform.py`). */

const INVOICES_PATH = '/billing/invoices';
const PAYMENTS_PATH = '/billing/payments';
const DUNNING_PATH = '/billing/dunning';
const SUBSCRIPTIONS_PATH = '/billing/subscriptions';
const PLAN_CHANGES_PATH = '/billing/plan-change-requests';

/** The dunning events that make up an invoice's reminder history. */
const REMINDER_KINDS = 'reminder_queued,reminder_sent';

/** Reminder history reads one wide page; an invoice rarely gets more than a handful. */
const REMINDER_PAGE_SIZE = 100;

/** Multi-value filters accept a comma-separated list (`core/filters.py`). */
function list(values: readonly string[]): string | undefined {
  return values.length > 0 ? values.join(',') : undefined;
}

function sortParam(field: string, direction: 'asc' | 'desc'): string {
  return direction === 'desc' ? `-${field}` : field;
}

/** The invoice list's filters, shared by the list and the CSV export. */
function invoiceFilters(params: InvoiceListParams) {
  return {
    q: params.q || undefined,
    status: list(params.statuses),
    due_from: params.dueFrom ?? undefined,
    due_to: params.dueTo ?? undefined,
    overdue: params.overdue ?? undefined,
    hospital_id: params.hospitalId,
    sort: sortParam(params.sortField, params.sortDirection),
  };
}

export async function getInvoices(params: InvoiceListParams) {
  const response = await platformApi.get(INVOICES_PATH, {
    params: { ...invoiceFilters(params), page: params.page, page_size: params.pageSize },
  });
  return invoicePageSchema.parse(response.data);
}

export async function getInvoice(id: string) {
  const response = await platformApi.get(`${INVOICES_PATH}/${encodeURIComponent(id)}`);
  return invoiceDetailSchema.parse(response.data);
}

/** The PDF bytes (`Content-Type: application/pdf`). */
export async function getInvoicePdf(id: string): Promise<Blob> {
  const response = await platformApi.get<Blob>(`${INVOICES_PATH}/${encodeURIComponent(id)}.pdf`, {
    responseType: 'blob',
  });
  return response.data;
}

/** Every matching invoice as CSV — the export ignores paging. */
export async function getInvoicesCsv(params: InvoiceListParams): Promise<Blob> {
  const response = await platformApi.get<Blob>(`${INVOICES_PATH}/export.csv`, {
    params: invoiceFilters(params),
    responseType: 'blob',
  });
  return response.data;
}

export async function postReminder(id: string) {
  const response = await platformApi.post(`${INVOICES_PATH}/${encodeURIComponent(id)}/reminders`);
  return invoiceSchema.parse(response.data);
}

/** Idempotency-Key is mandatory: a replayed submit must not record the money twice. */
export async function postMarkPaid(id: string, input: MarkPaidInput, key: string) {
  const response = await platformApi.post(
    `${INVOICES_PATH}/${encodeURIComponent(id)}/mark-paid`,
    {
      method: input.method,
      reference: input.reference,
      paid_at: input.paidAt,
      amount_paise: input.amountPaise,
    },
    { headers: idempotencyKey(key) },
  );
  return invoiceSchema.parse(response.data);
}

/** PATCH (not POST — `schema.yml` and the view agree). */
export async function patchGrace(id: string, graceEndsAt: string) {
  const response = await platformApi.patch(`${INVOICES_PATH}/${encodeURIComponent(id)}/grace`, {
    grace_ends_at: graceEndsAt,
  });
  return invoiceSchema.parse(response.data);
}

export async function postVoid(id: string, reason: string) {
  const response = await platformApi.post(`${INVOICES_PATH}/${encodeURIComponent(id)}/void`, {
    reason,
  });
  return invoiceSchema.parse(response.data);
}

/** The payment list's filters, shared by the list and the CSV export. */
function paymentFilters(params: PaymentListParams) {
  return {
    status: list(params.statuses),
    method: params.method ?? undefined,
    invoice_id: params.invoiceId ?? undefined,
    hospital_id: params.hospitalId,
    sort: sortParam(params.sortField, params.sortDirection),
  };
}

export async function getPayments(params: PaymentListParams) {
  const response = await platformApi.get(PAYMENTS_PATH, {
    params: { ...paymentFilters(params), page: params.page, page_size: params.pageSize },
  });
  return paymentPageSchema.parse(response.data);
}

/** `GET /platform/billing/payments/{id}` (BE-28) — one payment, so shared links always open. */
export async function getPayment(id: string) {
  const response = await platformApi.get(`${PAYMENTS_PATH}/${encodeURIComponent(id)}`);
  return paymentSchema.parse(response.data);
}

/** Every matching payment as CSV (BE-28, formula-safe on the server). */
export async function getPaymentsCsv(params: PaymentListParams): Promise<Blob> {
  const response = await platformApi.get<Blob>(`${PAYMENTS_PATH}/export.csv`, {
    params: paymentFilters(params),
    responseType: 'blob',
  });
  return response.data;
}

/**
 * `POST /platform/billing/payments/{id}/retry` (`billing.edit`, Idempotency-Key).
 * The backend answers 501 until gateway retries exist.
 */
export async function postPaymentRetry(id: string, key: string): Promise<void> {
  await platformApi.post(`${PAYMENTS_PATH}/${encodeURIComponent(id)}/retry`, null, {
    headers: idempotencyKey(key),
  });
}

/** `GET /platform/billing/summary` (BE-28, `billing.view`). */
export async function getBillingSummary() {
  const response = await platformApi.get('/billing/summary');
  return billingSummarySchema.parse(response.data);
}

export async function getReminderEvents(invoiceId: string) {
  const response = await platformApi.get(DUNNING_PATH, {
    params: { invoice_id: invoiceId, kind: REMINDER_KINDS, page_size: REMINDER_PAGE_SIZE },
  });
  return dunningPageSchema.parse(response.data);
}

export async function getSubscription(id: string) {
  const response = await platformApi.get(`${SUBSCRIPTIONS_PATH}/${encodeURIComponent(id)}`);
  return subscriptionSchema.parse(response.data);
}

export async function getSubscriptions(params: SubscriptionListParams) {
  const response = await platformApi.get(SUBSCRIPTIONS_PATH, {
    params: {
      status: list(params.statuses),
      hospital_id: params.hospitalId ?? undefined,
      plan_id: params.planId ?? undefined,
      billing_period: params.billingPeriod ?? undefined,
      page: params.page,
      page_size: params.pageSize,
    },
  });
  return subscriptionPageSchema.parse(response.data);
}

/**
 * `PATCH /platform/billing/subscriptions/{id}` (`If-Match`): a plan or period
 * change applies at once with proration (Q106); grace override per hospital.
 */
export async function patchSubscription(
  id: string,
  change: SubscriptionChange,
  version: number | null,
) {
  const response = await platformApi.patch(
    `${SUBSCRIPTIONS_PATH}/${encodeURIComponent(id)}`,
    {
      ...(change.planId !== undefined && { plan_id: change.planId }),
      ...(change.billingPeriod !== undefined && { billing_period: change.billingPeriod }),
      ...(change.graceDaysOverride !== undefined && {
        grace_days_override: change.graceDaysOverride,
      }),
    },
    { headers: version === null ? undefined : ifMatch(version) },
  );
  return subscriptionChangeSchema.parse(response.data);
}

/** `GET …/subscriptions/{id}/proration-preview?plan_id&billing_period` (BE-28) — writes nothing. */
export async function getProrationPreview(
  id: string,
  planId: string | null,
  billingPeriod: BillingPeriod | null,
) {
  const response = await platformApi.get(
    `${SUBSCRIPTIONS_PATH}/${encodeURIComponent(id)}/proration-preview`,
    { params: { plan_id: planId ?? undefined, billing_period: billingPeriod ?? undefined } },
  );
  return prorationPreviewSchema.parse(response.data);
}

/** `GET /platform/billing/dunning` — the dunning timeline across hospitals. */
export async function getDunningEvents(params: DunningListParams) {
  const response = await platformApi.get(DUNNING_PATH, {
    params: {
      hospital_id: params.hospitalId ?? undefined,
      kind: list(params.kinds),
      page: params.page,
      page_size: params.pageSize,
    },
  });
  return dunningPageSchema.parse(response.data);
}

export async function getPlanChanges(params: PlanChangeListParams) {
  const response = await platformApi.get(PLAN_CHANGES_PATH, {
    params: { status: list(params.statuses), page: params.page, page_size: params.pageSize },
  });
  return planChangePageSchema.parse(response.data);
}

/** `effective_at` is deprecated — omitted, so the change applies today. */
export async function postApprovePlanChange(id: string) {
  const response = await platformApi.post(
    `${PLAN_CHANGES_PATH}/${encodeURIComponent(id)}/approve`,
    {},
  );
  return planChangeApproveSchema.parse(response.data);
}

/** `GET …/plan-change-requests/{id}/preview` (BE-28) — what approving would issue now. */
export async function getPlanChangePreview(id: string) {
  const response = await platformApi.get(`${PLAN_CHANGES_PATH}/${encodeURIComponent(id)}/preview`);
  return prorationPreviewSchema.parse(response.data);
}

export async function postRejectPlanChange(id: string, note: string | null) {
  const response = await platformApi.post(`${PLAN_CHANGES_PATH}/${encodeURIComponent(id)}/reject`, {
    note,
  });
  return planChangeSchema.parse(response.data);
}
