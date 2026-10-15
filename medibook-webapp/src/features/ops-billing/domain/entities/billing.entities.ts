/**
 * Subscription billing as the platform API serves it (`/platform/billing/…`,
 * `subscriptions/serializers`). Amounts stay in paise — the unit the backend
 * stores (D-08) — and are converted only for display.
 */

export type InvoiceStatus = 'draft' | 'issued' | 'paid' | 'overdue' | 'void' | 'uncollectible';

/** The statuses the backend treats as awaiting payment (`UNPAID_INVOICE`). */
export const UNPAID_INVOICE_STATUSES: readonly InvoiceStatus[] = ['issued', 'overdue'];

export type PaymentStatus = 'created' | 'captured' | 'failed' | 'refunded';

/** `credit_note`: settled from a credit-note balance after a downgrade (M-25), never by hand. */
export type PaymentMethod = 'razorpay' | 'bank_transfer' | 'manual' | 'credit_note';

/** The methods ops can record by hand with mark-paid. */
export type ManualPaymentMethod = Exclude<PaymentMethod, 'credit_note'>;

/** Whether the last queued reminder reached the email provider (UAT-56). */
export type ReminderStatus = 'none' | 'queued' | 'sent';

/** Subscription lifecycle (`HospitalSubscription.Status`). */
export type SubscriptionStatus =
  'trialing' | 'active' | 'past_due' | 'grace' | 'read_only' | 'cancelled';

/** The statuses a live subscription can be in (subscriber counts exclude `cancelled`). */
export const LIVE_SUBSCRIPTION_STATUSES: readonly SubscriptionStatus[] = [
  'trialing',
  'active',
  'past_due',
  'grace',
  'read_only',
];

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
  /** When a reminder last reached the email provider; `null` before BE-28 or before any. */
  readonly lastReminderSentAt: string | null;
  /** `null` on a backend that does not report delivery. */
  readonly reminderStatus: ReminderStatus | null;
  readonly planName: string | null;
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
  /** Names on the row (BE-28); `null` on an older backend. */
  readonly hospitalName: string | null;
  readonly planName: string | null;
  /** Who recorded a manual payment. */
  readonly recordedByName: string | null;
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
  readonly hospitalId: string | null;
  readonly invoiceNo: string | null;
  readonly kind: DunningKind;
  /** No acting user: the scheduler did it. */
  readonly isAutomatic: boolean;
  readonly note: string | null;
  readonly occurredAt: string;
}

export interface BillingSubscription {
  readonly id: string;
  readonly hospitalId: string;
  readonly hospitalName: string | null;
  readonly planId: string | null;
  readonly planCode: string | null;
  readonly planName: string;
  readonly billingPeriod: BillingPeriod;
  readonly status: string;
  /** D-30: the tenant gate refuses the hospital's writes. */
  readonly readOnly: boolean;
  readonly startedAt: string | null;
  readonly trialEndsAt: string | null;
  readonly currentPeriodEnd: string | null;
  readonly nextInvoiceAt: string | null;
  readonly cancelAtPeriodEnd: boolean;
  /** Per-hospital grace in days; `null` = the platform default. */
  readonly graceDaysOverride: number | null;
  /** `If-Match` for a plan/period/grace change; `null` on an older backend. */
  readonly version: number | null;
}

export interface SubscriptionListParams {
  readonly page: number;
  readonly pageSize: number;
  readonly statuses: readonly SubscriptionStatus[];
  readonly hospitalId: string | null;
  readonly planId: string | null;
  readonly billingPeriod: BillingPeriod | null;
}

/** A plan, period or grace change made by ops (`PATCH …/subscriptions/{id}`). */
export interface SubscriptionChange {
  readonly planId?: string;
  readonly billingPeriod?: BillingPeriod;
  /** 0–90 days; `null` returns to the platform default. */
  readonly graceDaysOverride?: number | null;
}

export interface ProrationLine {
  readonly lineType: string;
  readonly description: string;
  /** Signed: credits are negative. */
  readonly amountPaise: number;
  readonly taxRateBp: number;
  readonly taxPaise: number;
  readonly totalPaise: number;
}

/**
 * What a plan or period change would issue right now (BE-28 preview): an
 * invoice for an upgrade, a credit note for a downgrade (M-25), or nothing.
 */
export interface ProrationPreview {
  readonly kind: 'none' | 'invoice' | 'credit_note' | string;
  readonly lines: readonly ProrationLine[];
  readonly subtotalPaise: number;
  readonly gstPaise: number;
  readonly totalPaise: number;
  readonly invoiceTotalPaise: number;
  readonly creditNoteTotalPaise: number;
  readonly newPeriodStart: string | null;
  readonly newPeriodEnd: string | null;
}

/** A document a plan change produced, enough to show and link it. */
export interface ProrationDocument {
  readonly id: string;
  readonly number: string;
  readonly totalPaise: number;
}

/** What approving a request or changing a subscription produced (UAT-57). */
export interface PlanChangeOutcome {
  readonly prorationInvoice: ProrationDocument | null;
  readonly creditNote: ProrationDocument | null;
}

/** An approved plan-change request and the documents it produced. */
export interface PlanChangeApproval {
  readonly request: PlanChangeRequest;
  readonly outcome: PlanChangeOutcome;
}

/** A subscription after an ops change, and the documents it produced. */
export interface SubscriptionChangeResult {
  readonly subscription: BillingSubscription;
  readonly outcome: PlanChangeOutcome;
}

/** The Ops Billing money tiles (`GET /platform/billing/summary`, BE-28). */
export interface BillingSummary {
  readonly mrrPaise: number;
  readonly outstandingPaise: number;
  readonly overduePaise: number;
  readonly unpaidInvoices: number;
  /** Captured in the range (default this month, IST). */
  readonly collectedPaise: number;
  readonly creditBalancePaise: number;
  readonly subscriptionsByStatus: Readonly<Record<string, number>>;
}

export interface DunningListParams {
  readonly page: number;
  readonly pageSize: number;
  readonly hospitalId: string | null;
  readonly kinds: readonly DunningKind[];
}

export interface PlanChangeRequest {
  readonly id: string;
  readonly hospitalId: string;
  /** Names on the row (BE-28); `null` on an older backend. */
  readonly hospitalName: string | null;
  readonly fromPlanName: string | null;
  readonly toPlanName: string | null;
  readonly fromPlanId: string;
  readonly toPlanId: string;
  readonly toBillingPeriod: BillingPeriod;
  readonly requestedAt: string;
  readonly note: string | null;
  readonly status: PlanChangeStatus;
  readonly reviewedAt: string | null;
  readonly reviewNote: string | null;
  /** The documents an applied change produced (UAT-57). */
  readonly prorationInvoiceId: string | null;
  readonly creditNoteId: string | null;
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
  /** One hospital's invoices only (its profile); omitted = every hospital. */
  readonly hospitalId?: string;
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
  /** One hospital's payments only (its profile); omitted = every hospital. */
  readonly hospitalId?: string;
}

export interface PlanChangeListParams {
  readonly page: number;
  readonly pageSize: number;
  readonly statuses: readonly PlanChangeStatus[];
}

export interface MarkPaidInput {
  readonly method: ManualPaymentMethod;
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
