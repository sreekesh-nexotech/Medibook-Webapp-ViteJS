/**
 * Settlement entities (`/hospital/settlements/*`, `/hospital/statements`).
 * Plain readonly types — no React, no Axios, no Zod. Money is integer paise,
 * exactly as the backend keeps it.
 */

/**
 * Settlement window lifecycle (backend `SettlementPeriod.Status`). Periods are
 * created closed (decision 11), so `open` stays in the type only because the
 * backend enum still lists it.
 */
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
  /** The period it pays, `yyyy-mm-dd`; `null` when the row does not say. */
  readonly periodStart: string | null;
  readonly periodEnd: string | null;
  readonly amountPaise: number;
  readonly status: PayoutStatus;
  readonly bankAccountLast4: string | null;
  /** Bank reference for the transfer, once released. */
  readonly utrRef: string | null;
  readonly releasedAt: string | null;
  readonly failureReason: string | null;
  readonly notes: string | null;
  readonly createdAt: string | null;
}

/** A manual correction Medibook applied to a period. */
export interface SettlementAdjustment {
  readonly id: string;
  /** Signed: negative reduces what the hospital is paid. */
  readonly amountPaise: number;
  readonly reason: string;
  readonly createdAt: string;
  /**
   * Posted after the period was paid: it settles in the next closed period,
   * not in this one's net (backend M-24).
   */
  readonly carriedForward: boolean;
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
  /** Adjustments posted after an earlier period was paid, settled in this one. */
  readonly carriedAdjustmentsPaise: number;
  /** Ledger rows journalled after an earlier close that rolled into this window. */
  readonly lateEntries: number;
  /**
   * The server's own check of the frozen net — `ledger net + adjustments − TDS`
   * and how far the net payable is from it. `null` from a server that does not
   * send it yet; the drawer then works the check out itself.
   */
  readonly expectedNetPaise: number | null;
  readonly differencePaise: number | null;
  readonly reconciled: boolean | null;
}

/** A monthly statement as a period links it. */
export interface StatementRef {
  readonly id: string;
  readonly statementNo: string;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly issuedAt: string;
}

/** `GET /settlements/periods/{id}` — the period plus everything behind its net. */
export interface SettlementPeriodDetail extends SettlementPeriod {
  readonly breakdown: SettlementBreakdown;
  readonly adjustments: readonly SettlementAdjustment[];
  readonly payout: Payout | null;
  /**
   * The statements of the months the period overlaps, the month containing
   * its start first (UAT-29). `null` from a server that does not link them
   * yet — the drawer then looks the month's statement up itself.
   */
  readonly statements: readonly StatementRef[] | null;
}

/**
 * The monthly statement Medibook issues (`PlatformStatement`, Q99). Statements
 * cover calendar months; settlement periods are custom windows.
 */
export interface SettlementStatement extends StatementRef {
  readonly bookingsCount: number;
  readonly grossPaise: number;
  readonly refundsPaise: number;
  readonly gatewayFeesPaise: number;
  readonly commissionPaise: number;
  readonly commissionGstPaise: number;
  readonly convenienceFeesPaise: number;
  readonly convenienceFeeGstPaise: number;
  readonly netPayablePaise: number;
  /** Stored PDF; `null` = the server renders it on the first download. */
  readonly pdfFileId: string | null;
}

/**
 * A statement PDF as the server hands it over: a short-lived signed link
 * (backend SET-02), or the file itself from a server that still sends bytes.
 */
export type StatementPdf =
  { readonly kind: 'link'; readonly url: string } | { readonly kind: 'file'; readonly blob: Blob };

/** Server sort fields of the statements list. */
export type StatementSortField = 'period_start' | 'issued_at';

/** One page of the statements list (`GET /hospital/statements`). */
export interface StatementListQuery {
  readonly page: number;
  readonly pageSize: number;
  /** Statements for months ending on or after this date (its own month included). */
  readonly dateFrom?: string;
  /** Statements for months starting on or before this date. */
  readonly dateTo?: string;
  readonly sortField: StatementSortField;
  readonly sortDirection: 'asc' | 'desc';
}

/** Server sort fields of the payouts list. */
export type PayoutSortField = 'created_at' | 'released_at' | 'amount_paise';

/** One page of the payouts list (`GET /hospital/settlements/payouts`). */
export interface PayoutListQuery {
  readonly page: number;
  readonly pageSize: number;
  /** Absent = every status. */
  readonly status?: PayoutStatus;
  readonly sortField: PayoutSortField;
  readonly sortDirection: 'asc' | 'desc';
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
