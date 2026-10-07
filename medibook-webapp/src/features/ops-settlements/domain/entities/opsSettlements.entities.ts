/**
 * Platform settlement entities (`/api/v1/platform/settlements/*`): one
 * settlement period per hospital per window, payout runs that batch the closed
 * periods, and one payout per period inside a run. Money is in rupees (the
 * API sends paise).
 */

/**
 * `open` stays in the type for rows an older backend may still hold; periods
 * are only ever created `closed` now (decision 11), and the console shows no
 * accruing figures.
 */
export type SettlementPeriodStatus = 'open' | 'closed' | 'paid' | 'on_hold';

/** The period statuses that are statements (everything but the retired `open`). */
export const STATEMENT_PERIOD_STATUSES: readonly SettlementPeriodStatus[] = [
  'closed',
  'paid',
  'on_hold',
];

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
  /** Who created the run — with four-eyes on, someone else approves and releases it. */
  readonly initiatedById: string | null;
}

/** Why a new run left a closed period out (M-45, decision 4). */
export type RunSkipReason = 'no_primary_bank_account' | 'bank_account_unverified';

export interface RunSkippedPeriod {
  readonly hospitalId: string;
  readonly settlementPeriodId: string | null;
  readonly netPayableRupees: number | null;
  /** A reason this build does not know is kept as sent. */
  readonly reason: string;
}

/** `POST …/payout-runs`: the draft run and the periods it could not pay. */
export interface PayoutRunCreated {
  readonly run: PayoutRun;
  readonly skipped: readonly RunSkippedPeriod[];
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
  /** Row extras from the flat payout list (BE-27); `null` when read through a run. */
  readonly runNo: string | null;
  readonly runStatus: PayoutRunStatus | null;
  readonly hospitalName: string | null;
  readonly periodStart: string | null;
  readonly periodEnd: string | null;
  /** `false` once the captured account lost its verification (release then refuses). */
  readonly bankAccountVerified: boolean | null;
}

/** Filters of the flat payout list. */
export interface PayoutFilter {
  readonly hospitalId: string | null;
}

/** Hold or fail a payout, with the reason ops give (`/payouts/{id}/hold|fail`). */
export type PayoutCommand = 'hold' | 'fail';

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

/** The live ledger breakdown of a period, with the reconciliation of its frozen net (BE-27). */
export interface PeriodBreakdown {
  readonly grossRupees: number;
  readonly refundsRupees: number;
  readonly gatewayFeesRupees: number;
  readonly commissionRupees: number;
  readonly commissionGstRupees: number;
  readonly convenienceFeesRupees: number;
  readonly convenienceFeeGstRupees: number;
  /** Adjustments posted after an earlier period was paid, settling here. */
  readonly carriedAdjustmentsRupees: number;
  readonly ledgerNetRupees: number;
  readonly bookingsCount: number;
  readonly entries: number;
  /** Rows journalled after a close but dated inside it, rolled into this window. */
  readonly lateEntries: number;
  /** `null` on a backend without the reconciliation. */
  readonly expectedNetRupees: number | null;
  readonly differenceRupees: number | null;
  readonly reconciled: boolean | null;
}

export interface SettlementAdjustment {
  readonly id: string;
  /** Signed: a negative amount is taken off the hospital's payable. */
  readonly amountRupees: number;
  readonly reason: string;
  /** Posted after the period was paid, so it lands in the next closed period. */
  readonly carriedForward: boolean;
  readonly createdAt: string;
}

/** A monthly platform statement overlapping a period. */
export interface PeriodStatementRef {
  readonly id: string;
  readonly statementNo: string;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly issuedAt: string | null;
}

export interface SettlementPeriodDetail {
  readonly period: SettlementPeriod;
  readonly closedAt: string | null;
  readonly breakdown: PeriodBreakdown | null;
  readonly adjustments: readonly SettlementAdjustment[];
  readonly payout: Payout | null;
  /** The statement of the month the period starts in, when issued. */
  readonly statementId: string | null;
  readonly statements: readonly PeriodStatementRef[];
}

/** `POST /platform/settlements/periods/close`: one hospital, or every hospital with activity. */
export interface PeriodCloseRequest {
  readonly hospitalId: string | null;
  readonly periodStart: string;
  readonly periodEnd: string;
}

export interface PeriodClosePreviewRow {
  readonly hospitalId: string;
  readonly hospitalName: string;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly netPayableRupees: number;
  readonly breakdown: PeriodBreakdown | null;
}

export interface PeriodCloseSkip {
  readonly hospitalId: string;
  /** e.g. `overlaps_existing_period`. */
  readonly reason: string;
}

/**
 * A close request's answer: the dry run's preview, or the periods closed.
 * `legacy` marks a backend without dry runs, which closed straight away.
 */
export type PeriodCloseOutcome =
  | {
      readonly kind: 'preview';
      readonly wouldClose: readonly PeriodClosePreviewRow[];
      readonly skipped: readonly PeriodCloseSkip[];
    }
  | {
      readonly kind: 'closed';
      readonly closed: readonly SettlementPeriod[];
      readonly skipped: readonly PeriodCloseSkip[];
      readonly legacy: boolean;
    };

/** A correction to one period's payable (`POST /platform/settlements/adjustments`). */
export interface AdjustmentDraft {
  readonly hospitalId: string;
  readonly settlementPeriodId: string;
  /** Signed rupees; paise conversion happens in infrastructure. */
  readonly amountRupees: number;
  readonly reason: string;
}

/** A monthly platform statement (Q99). */
export interface PlatformStatement {
  readonly id: string;
  readonly hospitalId: string;
  /** From the statement's hospital snapshot; `null` when it has none. */
  readonly hospitalName: string | null;
  readonly statementNo: string;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly issuedAt: string | null;
  readonly bookingsCount: number;
  readonly grossRupees: number;
  readonly convenienceFeesRupees: number;
  readonly convenienceFeeGstRupees: number;
  readonly commissionRupees: number;
  readonly commissionGstRupees: number;
  readonly gatewayFeesRupees: number;
  readonly refundsRupees: number;
  readonly netPayableRupees: number;
}

export interface StatementListParams {
  readonly page: number;
  readonly pageSize: number;
  readonly hospitalId: string | null;
  /** Month bounds on `period_start`, ISO dates. */
  readonly dateFrom: string | null;
  readonly dateTo: string | null;
}

export interface StatementIssueResult {
  readonly issued: readonly PlatformStatement[];
  /** Hospitals already issued for that month (or with no activity). */
  readonly skippedCount: number;
}

/** A file the server rendered (exports, PDFs). */
export interface SettlementFile {
  readonly blob: Blob;
  readonly filename: string;
}

/** A statement PDF: a short-lived signed link (SET-02), or the bytes on an older backend. */
export type StatementPdf =
  | { readonly kind: 'url'; readonly url: string; readonly statementNo: string }
  | { readonly kind: 'file'; readonly file: SettlementFile };

export type SettlementExportFormat = 'csv' | 'xlsx' | 'pdf';
