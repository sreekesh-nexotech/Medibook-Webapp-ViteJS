import { toPage } from '@/core/api/pagination';
import { attempt } from '@/core/error/attempt';

import type { BillingRepository } from '@/features/ops-billing/domain/repositories/billing.repository';
import {
  getInvoice,
  getInvoicePdf,
  getInvoices,
  getInvoicesCsv,
  getPayments,
  getPlanChanges,
  getReminderEvents,
  getSubscription,
  patchGrace,
  postApprovePlanChange,
  postMarkPaid,
  postRejectPlanChange,
  postReminder,
  postVoid,
} from '@/features/ops-billing/infrastructure/data-sources/remote/billing.api';
import {
  toBillingInvoice,
  toBillingInvoiceDetail,
  toBillingSubscription,
  toDunningEvent,
  toPlanChangeRequest,
  toSubscriptionPayment,
} from '@/features/ops-billing/infrastructure/data-sources/remote/billing.response';

const INVOICES_CSV_FILENAME = 'medibook-subscription-invoices.csv';

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
    attempt(async () => toPlanChangeRequest(await postApprovePlanChange(id))),

  rejectPlanChange: (id, note) =>
    attempt(async () => toPlanChangeRequest(await postRejectPlanChange(id, note))),
};
