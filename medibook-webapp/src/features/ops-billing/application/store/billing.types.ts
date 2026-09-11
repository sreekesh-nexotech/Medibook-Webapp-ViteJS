/**
 * Subscription-billing view-model types (interim entities for the static-seed
 * phase). Shapes transcribed from the design prototype's `OpsDB.invoices` and
 * `OpsDB.payments` (Ops.jsx), then extended for audit SA-03: "Invoices and
 * payments are read-only. No reminder, no mark-as-paid, no retry, no grace
 * period, no suspension-for-non-payment state."
 */

/** Lifecycle state of a subscription invoice. */
export type InvoiceStatus = 'Completed' | 'Pending' | 'Overdue' | 'Payment failed';

/** How a reminder would reach the hospital. */
export type ReminderChannel = 'Email' | 'SMS';

/**
 * One recorded payment reminder. The status is `Queued` and nothing else:
 * this build records that ops asked for a reminder, it does not deliver one,
 * so no control here may claim it was sent.
 */
export interface InvoiceReminder {
  readonly id: number;
  /** Stamp of the request, e.g. "June 13, 2026 · 14:32". */
  readonly at: string;
  readonly channel: ReminderChannel;
  /** Where it is addressed — the hospital's admin email or phone. */
  readonly to: string;
  readonly status: 'Queued';
  readonly by: string;
}

/** Payment channel used for a subscription payment. */
export type PaymentMethod = 'UPI' | 'Card' | 'NetBanking' | 'Bank transfer' | 'Cheque' | 'Cash';

/** The channels a hospital can pay through online (gateway-backed). */
export const ONLINE_PAYMENT_METHODS: readonly PaymentMethod[] = ['UPI', 'Card', 'NetBanking'];

/** The channels ops can record an off-gateway payment against. */
export const OFFLINE_PAYMENT_METHODS: readonly PaymentMethod[] = [
  'Bank transfer',
  'Cheque',
  'Cash',
  'UPI',
];

/** One subscription invoice issued to a hospital. */
export interface Invoice {
  readonly id: number;
  readonly no: string;
  /** Tenant id in the ops hospital registry (joined on id, never on name). */
  readonly hid: number;
  readonly hospital: string;
  /** Gross amount in ₹, inclusive of the 18% GST shown as its own line. */
  readonly amount: number;
  readonly issued: string;
  readonly due: string;
  readonly status: InvoiceStatus;
  /** Reminder history, newest first. Empty when none has been requested. */
  readonly reminders: readonly InvoiceReminder[];
  /**
   * Per-invoice grace window in days, overriding the hospital's own setting
   * and the platform default. `0` is a real value (no grace), so it must stay
   * distinguishable from "not configured" (`undefined`).
   */
  readonly graceDays?: number;
  /** Local-calendar ISO date the payment was received, once it is paid. */
  readonly paidOn?: string;
  readonly paidMode?: PaymentMethod;
  /** UTR / cheque number / gateway reference recorded with the payment. */
  readonly paidRef?: string;
}

/** Lifecycle state of a payment transaction. */
export type PaymentStatus = 'Success' | 'Pending' | 'Payment failed';

/** One payment transaction against a subscription invoice. */
export interface Payment {
  readonly id: number;
  readonly txn: string;
  readonly inv: string;
  /** Tenant id in the ops hospital registry (joined on id, never on name). */
  readonly hid: number;
  readonly hospital: string;
  readonly method: PaymentMethod;
  readonly amount: number;
  readonly date: string;
  readonly status: PaymentStatus;
  /** Attempts made on this transaction — 1 is the original, 2+ are retries. */
  readonly attempts: number;
  /** Stamp of the latest attempt, set when ops retries. */
  readonly lastAttemptAt?: string;
}
