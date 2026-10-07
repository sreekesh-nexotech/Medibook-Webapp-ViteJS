import type { Page } from '@/core/api/pagination';
import type { Result } from '@/core/error/failure';

import type {
  BillingFile,
  BillingInvoice,
  BillingInvoiceDetail,
  BillingPeriod,
  BillingSubscription,
  BillingSummary,
  DunningEvent,
  DunningListParams,
  InvoiceListParams,
  MarkPaidInput,
  PaymentListParams,
  PlanChangeApproval,
  PlanChangeListParams,
  PlanChangeRequest,
  ProrationPreview,
  SubscriptionChange,
  SubscriptionChangeResult,
  SubscriptionListParams,
  SubscriptionPayment,
} from '@/features/ops-billing/domain/entities/billing.entities';

/** Platform subscription billing: invoices, payments, dunning and plan changes. */
export interface BillingRepository {
  listInvoices(params: InvoiceListParams): Promise<Result<Page<BillingInvoice>>>;
  getInvoice(id: string): Promise<Result<BillingInvoiceDetail>>;
  /** The server-rendered PDF (a 501 when the server cannot render PDFs). */
  getInvoicePdf(id: string, invoiceNo: string): Promise<Result<BillingFile>>;
  /** Every invoice matching the filters (not just one page), as CSV. */
  exportInvoices(params: InvoiceListParams): Promise<Result<BillingFile>>;
  /** Queue a manual reminder; the backend handles delivery. */
  queueReminder(id: string): Promise<Result<BillingInvoice>>;
  /** Record a payment received outside the gateway; partial amounts allowed. */
  markPaid(
    id: string,
    input: MarkPaidInput,
    idempotencyKey: string,
  ): Promise<Result<BillingInvoice>>;
  /** Set when the grace window closes (an ISO date, not before the due date). */
  setGrace(id: string, graceEndsAt: string): Promise<Result<BillingInvoice>>;
  voidInvoice(id: string, reason: string): Promise<Result<BillingInvoice>>;
  listPayments(params: PaymentListParams): Promise<Result<Page<SubscriptionPayment>>>;
  listReminderEvents(invoiceId: string): Promise<Result<readonly DunningEvent[]>>;
  getSubscription(id: string): Promise<Result<BillingSubscription>>;
  listPlanChanges(params: PlanChangeListParams): Promise<Result<Page<PlanChangeRequest>>>;
  /** Applies the change at once, with proration; answers the documents it issued. */
  approvePlanChange(id: string): Promise<Result<PlanChangeApproval>>;
  rejectPlanChange(id: string, note: string | null): Promise<Result<PlanChangeRequest>>;
  /** What approving would issue now; `null` on a backend without the preview. */
  previewPlanChange(id: string): Promise<Result<ProrationPreview | null>>;
  listSubscriptions(params: SubscriptionListParams): Promise<Result<Page<BillingSubscription>>>;
  /** Plan / period change (with proration) or grace override; `version` guards it. */
  changeSubscription(
    id: string,
    change: SubscriptionChange,
    version: number | null,
  ): Promise<Result<SubscriptionChangeResult>>;
  /** What a plan / period change would issue now; `null` on a backend without the preview. */
  previewSubscriptionChange(
    id: string,
    planId: string | null,
    billingPeriod: BillingPeriod | null,
  ): Promise<Result<ProrationPreview | null>>;
  listDunning(params: DunningListParams): Promise<Result<Page<DunningEvent>>>;
  getPayment(id: string): Promise<Result<SubscriptionPayment>>;
  exportPayments(params: PaymentListParams): Promise<Result<BillingFile>>;
  retryPayment(id: string, idempotencyKey: string): Promise<Result<null>>;
  /** Money tiles; `null` on a backend without the summary. */
  getSummary(): Promise<Result<BillingSummary | null>>;
}
