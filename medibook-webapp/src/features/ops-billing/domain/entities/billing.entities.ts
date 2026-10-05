/**
 * Subscription billing as the platform API serves it (`/platform/billing/…`,
 * `subscriptions/serializers`). Amounts stay in paise — the unit the backend
 * stores (D-08) — and are converted only for display.
 */

export type InvoiceStatus = 'draft' | 'issued' | 'paid' | 'overdue' | 'void' | 'uncollectible';

/** The statuses the backend treats as awaiting payment (`UNPAID_INVOICE`). */
export const UNPAID_INVOICE_STATUSES: readonly InvoiceStatus[] = ['issued', 'overdue'];

export type PaymentStatus = 'created' | 'captured' | 'failed' | 'refunded';

export type PaymentMethod = 'razorpay' | 'bank_transfer' | 'manual';

export type BillingPeriod = 'monthly' | 'yearly';

export type DunningKind =
  | 'reminder_queued'
  | 'reminder_sent'
  | 'grace_started'
  | 'grace_extended'
  | 'suspended'
  | 'read_only'
  | 'reinstated'
  | 'marked_paid'
  | 'retry_scheduled'
  | 'retry_attempted'
  | 'voided';

export type PlanChangeStatus = 'requested' | 'approved' | 'rejected' | 'applied' | 'withdrawn';

export interface BillingInvoice {
  readonly id: string;
  readonly invoiceNo: string;
  readonly hospitalId: string;
  readonly hospitalName: string;
  readonly subscriptionId: string;
  /** ISO dates. */
  readonly periodStart: string;
  readonly periodEnd: string;
  /** ISO date-time. */
  readonly issuedAt: string;
  /** ISO date. */
  readonly dueAt: string;
  readonly subtotalPaise: number;
  readonly gstPaise: number;
  readonly totalPaise: number;
  readonly amountPaidPaise: number;
  readonly status: InvoiceStatus;
  readonly paidAt: string | null;
  /** ISO date the grace window closes, once one has started or been set. */
  readonly graceEndsAt: string | null;
  readonly remindersSent: number;
  readonly lastReminderAt: string | null;
  readonly version: number;
}

export interface InvoiceLine {
  readonly id: string;
  readonly lineType: string;
  readonly description: string;
  readonly quantity: number;
  readonly unitPaise: number;
  /** Signed: credits and proration credits are negative. */
  readonly amountPaise: number;
  /** Basis points: 1800 = 18%. */
  readonly taxRateBp: number;
  readonly taxPaise: number;
}

/** Who the invoice is from or to, as it was when the invoice was issued. */
export interface BillingParty {
  readonly name: string | null;
  readonly gstin: string | null;
  readonly email: string | null;
  readonly phone: string | null;
  /** Address parts joined for display. */
  readonly address: string;
}

export interface BillingInvoiceDetail extends BillingInvoice {
  readonly lines: readonly InvoiceLine[];
  readonly billedTo: BillingParty;
  readonly billedBy: BillingParty;
}

export interface SubscriptionPayment {
  readonly id: string;
  readonly invoiceId: string;
  readonly invoiceNo: string;
  readonly hospitalId: string;
  readonly amountPaise: number;
  readonly method: PaymentMethod;
  readonly gatewayPaymentId: string | null;
  readonly status: PaymentStatus;
  readonly attemptNo: number;
  readonly attemptedAt: string;
  readonly capturedAt: string | null;
  readonly failureReason: string | null;
  readonly referenceNote: string | null;
  readonly createdAt: string;
}

export interface DunningEvent {
  readonly id: string;
  readonly invoiceId: string;
  readonly kind: DunningKind;
  /** No acting user: the scheduler did it. */
  readonly isAutomatic: boolean;
  readonly note: string | null;
  readonly occurredAt: string;
}

export interface BillingSubscription {
  readonly id: string;
  readonly hospitalId: string;
  readonly planName: string;
  readonly billingPeriod: BillingPeriod;
  readonly status: string;
  /** Per-hospital grace in days; `null` = the platform default. */
  readonly graceDaysOverride: number | null;
}

export interface PlanChangeRequest {
  readonly id: string;
  readonly hospitalId: string;
  readonly fromPlanId: string;
  readonly toPlanId: string;
  readonly toBillingPeriod: BillingPeriod;
  readonly requestedAt: string;
  readonly note: string | null;
  readonly status: PlanChangeStatus;
  readonly reviewedAt: string | null;
  readonly reviewNote: string | null;
}

export type SortDirection = 'asc' | 'desc';

export type InvoiceSortField = 'issued_at' | 'due_at' | 'total_paise' | 'invoice_no';

export interface InvoiceListParams {
  readonly page: number;
  readonly pageSize: number;
  /** Invoice number. */
  readonly q: string;
  readonly statuses: readonly InvoiceStatus[];
  /** ISO dates, inclusive, on the due date. */
  readonly dueFrom: string | null;
  readonly dueTo: string | null;
  /** `true` = overdue, or issued and past due. */
  readonly overdue: boolean | null;
  readonly sortField: InvoiceSortField;
  readonly sortDirection: SortDirection;
}

export type PaymentSortField = 'attempted_at' | 'amount_paise';

export interface PaymentListParams {
  readonly page: number;
  readonly pageSize: number;
  readonly statuses: readonly PaymentStatus[];
  readonly method: PaymentMethod | null;
  readonly invoiceId: string | null;
  readonly sortField: PaymentSortField;
  readonly sortDirection: SortDirection;
}

export interface PlanChangeListParams {
  readonly page: number;
  readonly pageSize: number;
  readonly statuses: readonly PlanChangeStatus[];
}

export interface MarkPaidInput {
  readonly method: PaymentMethod;
  readonly reference: string | null;
  /** ISO date-time the money arrived. */
  readonly paidAt: string;
  readonly amountPaise: number;
}

/** A file the backend generated, ready for the browser to save. */
export interface BillingFile {
  readonly blob: Blob;
  readonly filename: string;
}
