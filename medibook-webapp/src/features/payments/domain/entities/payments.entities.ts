/**
 * Payments entities (module H9), as `/hospital/payments`, `/refunds`,
 * `/cash-sessions` and `/visits/{id}/receipts` serve them. Plain readonly
 * types. A payment line is money actually captured, failed or refunded
 * (D-27) — an appointment still waiting to be paid is not a line; it comes
 * from the appointments feature.
 */

export type PaymentLineStatus = 'captured' | 'failed' | 'refunded';

/** `desk` = collected at the hospital; `online` = prepaid through Medibook. */
export type PaymentChannel = 'desk' | 'online';

export type PaymentMethod =
  'upi' | 'card' | 'netbanking' | 'wallet' | 'emi' | 'paylater' | 'cash' | 'pos' | 'other';

/** The appointment lifecycle, as far as refunds care (backend `Appointment.Status`). */
export type BookingStatus =
  | 'pending_payment'
  | 'pending_approval'
  | 'scheduled'
  | 'checked_in'
  | 'in_consultation'
  | 'completed'
  | 'cancelled'
  | 'no_show';

/**
 * A refund's lifecycle (backend `Refund.Status`). `superseded` is a failed
 * refund that a later one replaced.
 */
export type RefundStatus = 'requested' | 'processing' | 'processed' | 'failed' | 'superseded';

export interface PaymentPatient {
  readonly id: string;
  readonly mrn: string;
  readonly fullName: string;
}

/** The latest refund of one payment line, as the line carries it (backend B3). */
export interface LineRefund {
  readonly id: string | null;
  readonly status: RefundStatus;
  readonly amountRupees: number | null;
  readonly failureReason: string | null;
}

/** One payment line. Exactly one of `appointmentId` / `visitId` is set. */
export interface PaymentLine {
  readonly id: string;
  /** The payment order the line belongs to: a refund covers every line of it. */
  readonly orderId: string | null;
  readonly appointmentId: string | null;
  /** A desk visit paid as one group of consultations. */
  readonly visitId: string | null;
  readonly channel: PaymentChannel;
  readonly method: PaymentMethod;
  readonly amountRupees: number;
  readonly status: PaymentLineStatus;
  readonly capturedAt: string | null;
  readonly referenceNote: string | null;
  readonly gatewayPaymentId: string | null;
  readonly collectedByName: string | null;
  readonly counterCode: string | null;
  /** The cash drawer a cash line went into. */
  readonly cashSessionId: string | null;
  readonly bookingRefs: readonly string[];
  readonly patient: PaymentPatient | null;
  /** From the line itself (backend B3); `null` on an older backend or for a visit. */
  readonly doctorName: string | null;
  readonly departmentName: string | null;
  /** The booking's own status (B3), which decides whether it may be refunded. */
  readonly bookingStatus: BookingStatus | null;
  readonly receiptNo: string | null;
  /**
   * The line's latest refund: `null` when it has none; `undefined` when the
   * backend does not say (an older backend), so the screen looks it up.
   */
  readonly latestRefund: LineRefund | null | undefined;
  readonly createdAt: string;
}

/** A refund attached to a payment line, as the detail and the refunds list serve it. */
export interface PaymentRefund {
  readonly id: string;
  readonly paymentId: string | null;
  readonly appointmentId: string | null;
  readonly bookingRef: string | null;
  readonly amountRupees: number;
  readonly method: string;
  readonly status: RefundStatus;
  readonly reason: string;
  readonly requestedAt: string | null;
  readonly processedAt: string | null;
  readonly failureReason: string | null;
  readonly cashSessionId: string | null;
  /** Where the refunded money was taken (B3); `null` on an older backend. */
  readonly channel: PaymentChannel | null;
}

/** `GET /payments/{id}` — the line plus every refund against it. */
export interface PaymentDetail {
  readonly line: PaymentLine;
  readonly refunds: readonly PaymentRefund[];
}

export type PaymentSortField = 'captured_at' | 'amount_paise';

export type SortDirection = 'asc' | 'desc';

/** Server-side filters shared by the list and its export. */
export interface PaymentFilters {
  /** Hospital-local ISO dates, inclusive. */
  readonly dateFrom: string;
  readonly dateTo: string;
  /** Line statuses to include; empty for every status. */
  readonly statuses: readonly PaymentLineStatus[];
  readonly method: PaymentMethod | null;
  readonly channel: PaymentChannel | null;
  readonly doctorId: string | null;
  readonly departmentId: string | null;
  readonly q: string;
}

export interface PaymentPageQuery extends PaymentFilters {
  /** 1-based. */
  readonly page: number;
  readonly pageSize: number;
  readonly sortField: PaymentSortField;
  readonly sortDirection: SortDirection;
}

/** One page of payment lines. */
export interface PaymentPage {
  readonly items: readonly PaymentLine[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly hasNext: boolean;
  /**
   * False when the backend could not filter by channel yet, so the rows are
   * every channel and the screen narrows the page itself.
   */
  readonly isChannelFiltered: boolean;
}

/** Server filters for the refunds list. */
export interface RefundListQuery {
  /** Hospital-local ISO dates the refund was requested on, inclusive. */
  readonly dateFrom: string;
  readonly dateTo: string;
  readonly statuses: readonly RefundStatus[];
  readonly method: PaymentMethod | null;
  /** 1-based. */
  readonly page: number;
  readonly pageSize: number;
}

/** One page of refunds. */
export interface RefundPage {
  readonly items: readonly PaymentRefund[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly hasNext: boolean;
}

/** What one refund request returned: one refund per captured line of the order. */
export interface RefundOutcome {
  readonly refunds: readonly PaymentRefund[];
}

/** One issued receipt of a desk visit (one per consultation). */
export interface VisitReceipt {
  readonly id: string;
  readonly receiptNo: string;
  readonly appointmentId: string | null;
  readonly totalRupees: number;
  readonly issuedAt: string;
}

/** Where a cash drawer stands (backend `CashSession.Status`). */
export type CashSessionStatus = 'open' | 'closed' | 'reconciled';

/**
 * One staff member's cash drawer for one business day (D-28). Cash payment
 * lines and cash refunds are only accepted while the collecting staff member
 * has an open session. Amounts stay in integer paise.
 */
export interface CashSession {
  readonly id: string;
  readonly staffId: string;
  readonly staffName: string;
  readonly counterId: string | null;
  readonly counterCode: string | null;
  /** Hospital-local ISO date the drawer belongs to. */
  readonly businessDate: string;
  readonly openedAt: string;
  readonly openingFloatPaise: number;
  /** Float + cash taken − cash refunded, kept by the server. */
  readonly expectedCashPaise: number;
  /** What the staff member counted at close; `null` while open or when auto-closed. */
  readonly countedCashPaise: number | null;
  /** Counted − expected; `null` until counted. */
  readonly variancePaise: number | null;
  readonly closedAt: string | null;
  readonly closedByName: string | null;
  readonly closeNote: string | null;
  /** Closed by the 23:59 job, with no count (BE-23). */
  readonly isAutoClosed: boolean;
  readonly status: CashSessionStatus;
  readonly reconciledAt: string | null;
  readonly reconciledByName: string | null;
  readonly reconcileNote: string | null;
  /** Row version for `If-Match` on close and reconcile; `null` on an older backend. */
  readonly version: number | null;
}

/** One drawer inside a staff member's day summary (B2). */
export interface CashSummaryDrawer {
  readonly id: string;
  readonly status: CashSessionStatus;
  readonly counterCode: string | null;
  readonly openedAt: string | null;
  readonly closedAt: string | null;
  readonly isAutoClosed: boolean;
  readonly openingFloatPaise: number;
  readonly cashInPaise: number;
  readonly cashRefundsPaise: number;
  readonly expectedCashPaise: number;
  readonly countedCashPaise: number | null;
  readonly variancePaise: number | null;
  readonly version: number | null;
}

/** One staff member's cash for a day (`GET /cash-sessions/summary`, v2 §5.6). */
export interface CashSummaryRow {
  readonly staffId: string;
  readonly staffName: string;
  readonly counters: readonly string[];
  readonly openSessions: number;
  readonly openingFloatPaise: number;
  readonly cashInPaise: number;
  readonly cashRefundsPaise: number;
  readonly expectedCashPaise: number;
  /** `null` while no drawer of the day is counted. */
  readonly countedCashPaise: number | null;
  /** What the counted drawers should have held — the base of the variance (B2). */
  readonly countedExpectedPaise: number | null;
  readonly variancePaise: number | null;
  readonly uncountedSessions: number;
  /** The day's drawers, each with its own figures (B2); empty on an older backend. */
  readonly drawers: readonly CashSummaryDrawer[];
}

/** The day's totals over the rows returned. */
export interface CashSummaryTotals {
  readonly openingFloatPaise: number;
  readonly cashInPaise: number;
  readonly cashRefundsPaise: number;
  readonly expectedCashPaise: number;
}

/** `GET /cash-sessions/summary` — every drawer for overseers, only one's own otherwise. */
export interface CashSummary {
  /** Hospital-local date the figures are for. */
  readonly date: string;
  /** `own` = only the signed-in member's drawers (BE-23); `all` on an older backend. */
  readonly scope: 'all' | 'own';
  readonly rows: readonly CashSummaryRow[];
  readonly totals: CashSummaryTotals | null;
}

/** A front-desk counter a drawer can be opened at. */
export interface CashCounter {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly isActive: boolean;
}

/** The cash movements of one drawer, for the reconcile drill-down. */
export interface CashSessionActivity {
  readonly payments: readonly PaymentLine[];
  readonly refunds: readonly PaymentRefund[];
}

/** Everything a drawer close or reconcile write needs to be replay-safe. */
export interface CashWriteGuard {
  /** The version read, sent as `If-Match`; `null` when the backend has none. */
  readonly version: number | null;
  /** One per user action, reused on retry. */
  readonly idempotencyKey: string;
}

/** The server-built exports of the payment list. */
export type PaymentExportFormat = 'csv' | 'xlsx' | 'pdf';

export interface PaymentExportFile {
  readonly blob: Blob;
  readonly filename: string;
  /** The server stopped at its row cap (`X-Export-Truncated`). */
  readonly isTruncated: boolean;
  readonly rowLimit: number | null;
}
