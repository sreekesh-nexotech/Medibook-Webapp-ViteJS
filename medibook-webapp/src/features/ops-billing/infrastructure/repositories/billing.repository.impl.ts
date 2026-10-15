import { toPage } from '@/core/api/pagination';
import { attempt } from '@/core/error/attempt';
import type { Result } from '@/core/error/failure';
import { ok } from '@/core/error/failure';

import type { BillingRepository } from '@/features/ops-billing/domain/repositories/billing.repository';
import {
  getBillingSummary,
  getDunningEvents,
  getInvoice,
  getInvoicePdf,
  getInvoices,
  getInvoicesCsv,
  getPayment,
  getPayments,
  getPaymentsCsv,
  getPlanChangePreview,
  getPlanChanges,
  getProrationPreview,
  getReminderEvents,
  getSubscription,
  getSubscriptions,
  patchGrace,
  patchSubscription,
  postApprovePlanChange,
  postMarkPaid,
  postPaymentRetry,
  postRejectPlanChange,
  postReminder,
  postVoid,
} from '@/features/ops-billing/infrastructure/data-sources/remote/billing.api';
import {
  toBillingInvoice,
  toBillingInvoiceDetail,
  toBillingSubscription,
  toBillingSummary,
  toDunningEvent,
  toPlanChangeOutcome,
  toPlanChangeRequest,
  toProrationPreview,
  toSubscriptionPayment,
} from '@/features/ops-billing/infrastructure/data-sources/remote/billing.response';

const INVOICES_CSV_FILENAME = 'medibook-subscription-invoices.csv';
const PAYMENTS_CSV_FILENAME = 'medibook-subscription-payments.csv';

/**
 * An endpoint BE-28 added answers 404 on an older backend: report "not
 * available" (`null`) so the screen falls back instead of erroring.
 */
async function orNullWhenMissing<T>(run: () => Promise<T>): Promise<Result<T | null>> {
  const result = await attempt(run);
  return !result.ok && result.failure.kind === 'notFound' ? ok(null) : result;
}

/** Keep a filename to what every OS accepts. */
function safeFilename(name: string): string {
  return name.replace(/[^A-Za-z0-9._-]/g, '_');
}

export const billingRepository: BillingRepository = {
  listInvoices: (params) =>
    attempt(async () => toPage(await getInvoices(params), toBillingInvoice)),

  getInvoice: (id) => attempt(async () => toBillingInvoiceDetail(await getInvoice(id))),

  getInvoicePdf: (id, invoiceNo) =>
    attempt(async () => ({
      blob: await getInvoicePdf(id),
      filename: `${safeFilename(invoiceNo)}.pdf`,
    })),

  exportInvoices: (params) =>
    attempt(async () => ({ blob: await getInvoicesCsv(params), filename: INVOICES_CSV_FILENAME })),

  queueReminder: (id) => attempt(async () => toBillingInvoice(await postReminder(id))),

  markPaid: (id, input, key) =>
    attempt(async () => toBillingInvoice(await postMarkPaid(id, input, key))),

  setGrace: (id, graceEndsAt) =>
    attempt(async () => toBillingInvoice(await patchGrace(id, graceEndsAt))),

  voidInvoice: (id, reason) => attempt(async () => toBillingInvoice(await postVoid(id, reason))),

  listPayments: (params) =>
    attempt(async () => toPage(await getPayments(params), toSubscriptionPayment)),

  listReminderEvents: (invoiceId) =>
    attempt(async () => (await getReminderEvents(invoiceId)).results.map(toDunningEvent)),

  getSubscription: (id) => attempt(async () => toBillingSubscription(await getSubscription(id))),

  listPlanChanges: (params) =>
    attempt(async () => toPage(await getPlanChanges(params), toPlanChangeRequest)),

  approvePlanChange: (id) =>
    attempt(async () => {
      const dto = await postApprovePlanChange(id);
      return { request: toPlanChangeRequest(dto.request), outcome: toPlanChangeOutcome(dto) };
    }),

  rejectPlanChange: (id, note) =>
    attempt(async () => toPlanChangeRequest(await postRejectPlanChange(id, note))),

  previewPlanChange: (id) =>
    orNullWhenMissing(async () => toProrationPreview(await getPlanChangePreview(id))),

  listSubscriptions: (params) =>
    attempt(async () => toPage(await getSubscriptions(params), toBillingSubscription)),

  changeSubscription: (id, change, version) =>
    attempt(async () => {
      const dto = await patchSubscription(id, change, version);
      return {
        subscription: toBillingSubscription(dto.subscription),
        outcome: toPlanChangeOutcome(dto),
      };
    }),

  previewSubscriptionChange: (id, planId, billingPeriod) =>
    orNullWhenMissing(async () =>
      toProrationPreview(await getProrationPreview(id, planId, billingPeriod)),
    ),

  listDunning: (params) =>
    attempt(async () => toPage(await getDunningEvents(params), toDunningEvent)),

  getPayment: (id) => attempt(async () => toSubscriptionPayment(await getPayment(id))),

  exportPayments: (params) =>
    attempt(async () => ({ blob: await getPaymentsCsv(params), filename: PAYMENTS_CSV_FILENAME })),

  retryPayment: (id, key) =>
    attempt(async () => {
      await postPaymentRetry(id, key);
      return null;
    }),

  getSummary: () => orNullWhenMissing(async () => toBillingSummary(await getBillingSummary())),
};
