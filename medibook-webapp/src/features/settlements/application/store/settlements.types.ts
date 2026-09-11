/**
 * Interim view-model types for weekly settlements (Medibook -> hospital).
 * Shared lifecycle with the ops console: Pending -> Released (by Medibook)
 * -> Received (confirmed by the hospital); Overdue = past expected without
 * release; "Payout failed" occurs on the ops side.
 */

export type SettlementStatus = 'Pending' | 'Overdue' | 'Released' | 'Received' | 'Payout failed';

export interface Settlement {
  readonly id: string;
  /** Statement period label, e.g. "10 – 16 Jun 2026". */
  readonly period: string;
  /** Gross online fees accrued for completed appointments. */
  readonly gross: number;
  /** Expected transfer date (ISO). */
  readonly expected: string;
  readonly status: SettlementStatus;
  /** Tenant id in the ops registry — cross-app records join on it. */
  readonly hid: number;
  readonly hospital: string;
  readonly utr: string | null;
  readonly remark: string | null;
  /** Platform commission (10% of gross), materialized. */
  readonly commission: number;
  /** Net transferred = gross - commission, materialized. */
  readonly net: number;
  /** ISO date the hospital confirmed receipt (Received rows only). */
  readonly receivedOn: string | null;
  /** Lifecycle fields written by release / request actions. */
  readonly releasedAmt?: number;
  readonly requested?: boolean;
  readonly requestedOn?: string;
}

/** Payment state of a subscription invoice Medibook raises to the hospital. */
export type PlanInvoiceStatus = 'Paid' | 'Pending';

/**
 * One monthly plan (subscription) invoice — the ops → hospital document, not a
 * patient receipt. `total` is the GST-inclusive amount charged; the 18% GST
 * component is derived with `splitGst` so the invoice always shows it as its
 * own line.
 */
export interface PlanInvoice {
  /** Canonical invoice series, e.g. `INV-2026-0001`. */
  readonly id: string;
  /** Canonical financial-year receipt series, e.g. `MB/R/2026-27/000123`. */
  readonly receipt: string;
  /** Invoice date (ISO). */
  readonly date: string;
  /** Plan label as billed, e.g. "Growth · Monthly". */
  readonly plan: string;
  /** GST-inclusive total in whole rupees. */
  readonly total: number;
  readonly status: PlanInvoiceStatus;
  /** ISO date the invoice was settled (null while pending). */
  readonly paidOn: string | null;
  /** How it was paid, e.g. "UPI". */
  readonly mode: string;
}
