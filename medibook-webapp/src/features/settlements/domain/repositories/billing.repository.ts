import type { Page } from '@/core/api/pagination';
import type { Result } from '@/core/error/failure';

import type {
  BillingInvoice,
  BillingInvoiceDetail,
  BillingPlan,
  BillingUsage,
  CreditNote,
  PlanChangeInput,
  PlanChangeRequest,
  Subscription,
} from '@/features/settlements/domain/entities/billing.entities';

/** The hospital's Medibook subscription. */
export interface BillingRepository {
  getSubscription(): Promise<Result<Subscription>>;
  getUsage(): Promise<Result<BillingUsage>>;
  listInvoices(page: number, pageSize: number): Promise<Result<Page<BillingInvoice>>>;
  getInvoice(invoiceId: string): Promise<Result<BillingInvoiceDetail>>;
  getInvoicePdf(invoiceId: string): Promise<Result<Blob>>;
  listPlans(): Promise<Result<readonly BillingPlan[]>>;
  listPlanChangeRequests(): Promise<Result<readonly PlanChangeRequest[]>>;
  requestPlanChange(input: PlanChangeInput): Promise<Result<PlanChangeRequest>>;
  /** The hospital's credit notes, newest first; empty from a server without them. */
  listCreditNotes(): Promise<Result<readonly CreditNote[]>>;
}
