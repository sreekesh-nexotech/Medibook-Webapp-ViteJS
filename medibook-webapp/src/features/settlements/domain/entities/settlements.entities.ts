/**
 * Settlement entities (`/hospital/settlements/*`, `/hospital/statements`).
 * Plain readonly types — no React, no Axios, no Zod. Money is integer paise,
 * exactly as the backend keeps it.
 */

/** Settlement window lifecycle (backend `SettlementPeriod.Status`). */
export type SettlementPeriodStatus = 'open' | 'closed' | 'paid' | 'on_hold';

/** Bank transfer lifecycle (backend `Payout.Status`). */
export type PayoutStatus = 'pending' | 'released' | 'failed' | 'on_hold';

/** One settlement window: what Medibook collected for the hospital and owes it. */
export interface SettlementPeriod {
  readonly id: string;
  /** Local calendar dates, `yyyy-mm-dd`, both inclusive. */
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly status: SettlementPeriodStatus;
  readonly grossPaise: number;
  readonly refundsPaise: number;
  readonly gatewayFeesPaise: number;
  readonly commissionPaise: number;
  readonly adjustmentsPaise: number;
  readonly tdsPaise: number;
  readonly netPayablePaise: number;
  /** ISO date-time the window was closed, `null` while open. */
  readonly closedAt: string | null;
}

/** The transfer that pays a period out. */
export interface Payout {
  readonly id: string;
  readonly settlementPeriodId: string;
  readonly amountPaise: number;
  readonly status: PayoutStatus;
  readonly bankAccountLast4: string | null;
  /** Bank reference for the transfer, once released. */
  readonly utrRef: string | null;
  readonly releasedAt: string | null;
  readonly failureReason: string | null;
  readonly notes: string | null;
}

/** A manual correction Medibook applied to a period. */
export interface SettlementAdjustment {
  readonly id: string;
  /** Signed: negative reduces what the hospital is paid. */
  readonly amountPaise: number;
  readonly reason: string;
  readonly createdAt: string;
}

/** Live per-type totals of the period window, from the ledger. */
export interface SettlementBreakdown {
  readonly grossPaise: number;
  readonly refundsPaise: number;
  readonly gatewayFeesPaise: number;
  readonly commissionPaise: number;
  readonly commissionGstPaise: number;
  readonly convenienceFeesPaise: number;
  readonly convenienceFeeGstPaise: number;
  readonly ledgerNetPaise: number;
  readonly bookingsCount: number;
}

/** `GET /settlements/periods/{id}` — the period plus everything behind its net. */
export interface SettlementPeriodDetail extends SettlementPeriod {
  readonly breakdown: SettlementBreakdown;
  readonly adjustments: readonly SettlementAdjustment[];
  readonly payout: Payout | null;
}

/** The statement Medibook issues for a period (`PlatformStatement`). */
export interface SettlementStatement {
  readonly id: string;
  readonly statementNo: string;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly issuedAt: string;
  /** Stored PDF, downloadable through the shared files API; `null` = render on demand. */
  readonly pdfFileId: string | null;
}

/** Server filters for the periods list. Absent = no filter. */
export interface SettlementPeriodFilters {
  /** Periods ending on or after this date. */
  readonly dateFrom?: string;
  /** Periods starting on or before this date. */
  readonly dateTo?: string;
}

/** A window of the periods list: the rows fetched plus whether more exist. */
export interface SettlementPeriodWindow {
  readonly items: readonly SettlementPeriod[];
  readonly total: number;
  readonly hasMore: boolean;
}
