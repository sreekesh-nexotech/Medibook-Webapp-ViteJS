import type { Page } from '@/core/api/pagination';
import type { Result } from '@/core/error/failure';

import type {
  BillingFile,
  BillingInvoice,
  BillingInvoiceDetail,
  BillingSubscription,
  DunningEvent,
  InvoiceListParams,
  MarkPaidInput,
  PaymentListParams,
  PlanChangeListParams,
  PlanChangeRequest,
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
  /** Applies the change at once, with proration. */
  approvePlanChange(id: string): Promise<Result<PlanChangeRequest>>;
  rejectPlanChange(id: string, note: string | null): Promise<Result<PlanChangeRequest>>;
}
