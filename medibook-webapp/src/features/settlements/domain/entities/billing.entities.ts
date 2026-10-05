/**
 * Plan & Billing entities (`/hospital/billing/*`) — the hospital's Medibook
 * subscription, its usage against plan limits, subscription invoices and plan
 * change requests. Plain readonly types; money is integer paise.
 */

export type BillingPeriod = 'monthly' | 'yearly';

/** Backend `HospitalSubscription.Status`; unknown future values pass through as strings. */
export type SubscriptionStatus =
  'trialing' | 'active' | 'past_due' | 'grace' | 'read_only' | 'cancelled';

/** A plan from the public catalogue (`Plan`). */
export interface BillingPlan {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly priceMonthlyPaise: number;
  /** `null` when the plan is sold monthly only. */
  readonly priceYearlyPaise: number | null;
  /** GST in basis points, e.g. 1800 = 18%. */
  readonly gstRateBp: number;
}

/** `GET /billing/subscription`. */
export interface Subscription {
  readonly id: string;
  readonly plan: BillingPlan;
  readonly billingPeriod: BillingPeriod | string;
  readonly status: SubscriptionStatus | string;
  /** Subscription lapsed: reads work, writes are refused (D-30). */
  readonly readOnly: boolean;
  readonly currentPeriodStart: string | null;
  readonly currentPeriodEnd: string | null;
  readonly nextInvoiceAt: string | null;
  readonly trialEndsAt: string | null;
  readonly cancelAtPeriodEnd: boolean;
}

/** The three metrics plans limit (Q102). */
export type UsageMetric = 'users' | 'doctors' | 'storage';

export interface UsageMeter {
  readonly metric: UsageMetric;
  readonly current: number;
  /** `null` = unlimited. */
  readonly limit: number | null;
  /** A hard limit blocks new records past the cap; a soft one only warns. */
  readonly hard: boolean;
}

/** `GET /billing/usage`. */
export interface BillingUsage {
  readonly periodStart: string | null;
  readonly meters: readonly UsageMeter[];
}

/** Backend `SubscriptionInvoice.Status`. */
export type InvoiceStatus = 'draft' | 'issued' | 'paid' | 'overdue' | 'void' | 'uncollectible';

/** One subscription invoice Medibook raised to the hospital. */
export interface BillingInvoice {
  readonly id: string;
  readonly invoiceNo: string;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly issuedAt: string;
  /** Local date `yyyy-mm-dd`. */
  readonly dueAt: string;
  readonly subtotalPaise: number;
  readonly gstPaise: number;
  readonly totalPaise: number;
  readonly amountPaidPaise: number;
  readonly status: InvoiceStatus | string;
  readonly paidAt: string | null;
}

export interface BillingInvoiceLine {
  readonly id: string;
  readonly description: string;
  readonly quantity: number;
  readonly amountPaise: number;
  readonly taxRateBp: number;
  readonly taxPaise: number;
}

/** The party block printed on an invoice, frozen when it was issued. */
export interface InvoiceParty {
  readonly name: string;
  readonly gstin: string | null;
  /** Address lines, city/state/pincode joined; blanks dropped. */
  readonly addressLines: readonly string[];
}

/** `GET /billing/invoices/{id}`. */
export interface BillingInvoiceDetail extends BillingInvoice {
  readonly lines: readonly BillingInvoiceLine[];
  readonly billedTo: InvoiceParty;
  readonly issuer: InvoiceParty;
}

export type PlanChangeStatus = 'requested' | 'approved' | 'rejected' | 'applied' | 'withdrawn';

export interface PlanChangeRequest {
  readonly id: string;
  readonly toPlanId: string;
  readonly toBillingPeriod: BillingPeriod | string;
  readonly requestedAt: string;
  readonly status: PlanChangeStatus | string;
  readonly note: string | null;
  readonly reviewNote: string | null;
}

/** What the hospital submits to ask for a plan change. */
export interface PlanChangeInput {
  readonly toPlanId: string;
  readonly toBillingPeriod: BillingPeriod;
  readonly note: string | null;
}
