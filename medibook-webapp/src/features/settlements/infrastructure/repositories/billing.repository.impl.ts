import { toPage } from '@/core/api/pagination';
import { attempt } from '@/core/error/attempt';

import type { BillingRepository } from '@/features/settlements/domain/repositories/billing.repository';
import {
  getCreditNotes,
  getInvoice,
  getInvoicePdf,
  getInvoices,
  getPlanChangeRequests,
  getPlans,
  getSubscription,
  getUsage,
  postPlanChangeRequest,
} from '@/features/settlements/infrastructure/data-sources/remote/billing.api';
import {
  toBillingInvoice,
  toBillingInvoiceDetail,
  toBillingPlan,
  toBillingUsage,
  toCreditNote,
  toPlanChangeRequest,
  toSubscription,
} from '@/features/settlements/infrastructure/data-sources/remote/billing.response';

export const billingRepository: BillingRepository = {
  getSubscription: () => attempt(async () => toSubscription(await getSubscription())),

  getUsage: () => attempt(async () => toBillingUsage(await getUsage())),

  listInvoices: (page, pageSize) =>
    attempt(async () => toPage(await getInvoices(page, pageSize), toBillingInvoice)),

  getInvoice: (invoiceId) =>
    attempt(async () => toBillingInvoiceDetail(await getInvoice(invoiceId))),

  getInvoicePdf: (invoiceId) => attempt(() => getInvoicePdf(invoiceId)),

  listPlans: () => attempt(async () => (await getPlans()).results.map(toBillingPlan)),

  listPlanChangeRequests: () =>
    attempt(async () => (await getPlanChangeRequests()).results.map(toPlanChangeRequest)),

  requestPlanChange: (input) =>
    attempt(async () => toPlanChangeRequest(await postPlanChangeRequest(input))),

  listCreditNotes: () =>
    attempt(async () => (await getCreditNotes())?.results.map(toCreditNote) ?? []),
};
