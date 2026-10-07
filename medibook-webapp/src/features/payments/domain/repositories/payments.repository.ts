import type { Result } from '@/core/error/failure';

import type {
  CashCounter,
  CashSession,
  CashSessionActivity,
  CashSummary,
  CashWriteGuard,
  PaymentDetail,
  PaymentExportFile,
  PaymentExportFormat,
  PaymentFilters,
  PaymentLine,
  PaymentPage,
  PaymentPageQuery,
  RefundListQuery,
  RefundOutcome,
  RefundPage,
  VisitReceipt,
} from '@/features/payments/domain/entities/payments.entities';

/** Hospital payments (H9): payment lines, their refunds, visit receipts, cash drawers. */
export interface PaymentsRepository {
  listPayments(query: PaymentPageQuery): Promise<Result<PaymentPage>>;
  /** Every line matching `filters` (all pages) — for the day's totals. */
  listAllPayments(filters: PaymentFilters): Promise<Result<readonly PaymentLine[]>>;
  /** Every line of one payment order — what a refund of that booking covers. */
  listOrderLines(
    orderId: string,
    bookingRef: string | null,
  ): Promise<Result<readonly PaymentLine[]>>;
  /** One line with every refund against it. */
  getPayment(paymentId: string): Promise<Result<PaymentDetail>>;
  listVisitReceipts(visitId: string): Promise<Result<readonly VisitReceipt[]>>;
  /** The server-built CSV, Excel or PDF of every line matching `filters`. */
  exportPayments(
    filters: PaymentFilters,
    format: PaymentExportFormat,
  ): Promise<Result<PaymentExportFile>>;
  /** One page of refunds (desk and online), by the day they were requested. */
  listRefunds(query: RefundListQuery): Promise<Result<RefundPage>>;
  /** Every refund requested in a date window — for the day's figures. */
  listAllRefunds(dateFrom: string, dateTo: string): Promise<Result<RefundPage['items']>>;
  /**
   * Refund a booking in full: one refund per captured line of its paid order,
   * to each line's own method (Q94, Q95). `idempotencyKey` is one per user action.
   */
  refundBooking(
    appointmentId: string,
    reason: string,
    idempotencyKey: string,
  ): Promise<Result<RefundOutcome>>;

  /** The day's cash per staff member; `date` omitted = hospital-local today. */
  getCashSummary(date: string | null): Promise<Result<CashSummary>>;
  /** `staffId`'s open cash drawer, or `null` when it is closed. */
  getOpenCashSession(staffId: string): Promise<Result<CashSession | null>>;
  /** The hospital's counters a drawer may be opened at. */
  listCounters(): Promise<Result<readonly CashCounter[]>>;
  /** Open the signed-in staff member's drawer with a float, at a counter or their default. */
  openCashSession(
    openingFloatPaise: number,
    counterId: string | null,
    idempotencyKey: string,
  ): Promise<Result<CashSession>>;
  /** Close a drawer with the cash counted; the server works out the variance. */
  closeCashSession(
    id: string,
    countedCashPaise: number,
    note: string | null,
    guard: CashWriteGuard,
  ): Promise<Result<CashSession>>;
  /** Closed drawers waiting for an admin to reconcile, oldest first. */
  listCashSessionsToReconcile(): Promise<Result<readonly CashSession[]>>;
  /**
   * Reconcile a closed drawer. `countedCashPaise` records the cash found in a
   * drawer that was never counted (auto-closed); `note` is the reconciler's.
   */
  reconcileCashSession(
    id: string,
    countedCashPaise: number | null,
    note: string | null,
    guard: CashWriteGuard,
  ): Promise<Result<CashSession>>;
  /** The cash payments and refunds that went through one drawer. */
  getCashSessionActivity(
    sessionId: string,
    businessDate: string,
  ): Promise<Result<CashSessionActivity>>;
}
