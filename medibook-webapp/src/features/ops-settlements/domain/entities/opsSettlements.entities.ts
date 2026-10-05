/**
 * Platform settlement entities (`/api/v1/platform/settlements/*`): one
 * settlement period per hospital per window, payout runs that batch the closed
 * periods, and one payout per period inside a run. Money is in rupees (the
 * API sends paise).
 */

export type SettlementPeriodStatus = 'open' | 'closed' | 'paid' | 'on_hold';

export type PayoutRunStatus =
  'draft' | 'approved' | 'processing' | 'released' | 'partially_failed' | 'failed';

export type PayoutStatus = 'pending' | 'released' | 'failed' | 'on_hold';

export interface SettlementPeriod {
  readonly id: string;
  readonly hospitalId: string;
  readonly hospitalName: string;
  /** ISO dates, inclusive. */
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly status: SettlementPeriodStatus;
  readonly grossRupees: number;
  readonly refundsRupees: number;
  readonly gatewayFeesRupees: number;
  readonly commissionRupees: number;
  readonly adjustmentsRupees: number;
  readonly tdsRupees: number;
  readonly netPayableRupees: number;
}

export interface PayoutRun {
  readonly id: string;
  readonly runNo: string;
  readonly status: PayoutRunStatus;
  readonly periodStart: string;
  readonly periodEnd: string;
  /** ISO date the transfers are planned for, if set. */
  readonly scheduledFor: string | null;
  readonly approvedAt: string | null;
  readonly releasedAt: string | null;
  readonly totalRupees: number;
  readonly hospitalCount: number;
  readonly notes: string | null;
}

export interface Payout {
  readonly id: string;
  readonly payoutRunId: string;
  readonly settlementPeriodId: string;
  readonly hospitalId: string;
  /** Last four digits of the hospital's primary payout account; `null` when none was on file. */
  readonly bankAccountLast4: string | null;
  readonly hasBankAccount: boolean;
  readonly amountRupees: number;
  readonly status: PayoutStatus;
  readonly utrRef: string | null;
  readonly releasedAt: string | null;
  readonly failureReason: string | null;
  readonly notes: string | null;
}

export interface PayoutRunDetail {
  readonly run: PayoutRun;
  readonly payouts: readonly Payout[];
}

/** Which periods to list; dates bound the period window (`period_end ≥ from`, `period_start ≤ to`). */
export interface PeriodFilter {
  readonly statuses: readonly SettlementPeriodStatus[];
  readonly dateFrom: string | null;
  readonly dateTo: string | null;
  /** One hospital's periods only (its profile); omitted = every hospital. */
  readonly hospitalId?: string;
}

/** A new payout run gathers every closed, unpaid period inside the window. */
export interface PayoutRunDraft {
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly scheduledFor: string | null;
  readonly notes: string | null;
}

export interface PayoutRelease {
  readonly payoutId: string;
  /** The bank transfer reference the money moved under. */
  readonly utrRef: string;
}
