import type { Page } from '@/core/api/pagination';
import type { Result } from '@/core/error/failure';

import type {
  CashSession,
  CashSummaryRow,
  PaymentExportFile,
  PaymentExportFormat,
  PaymentFilters,
  PaymentLine,
  PaymentPageQuery,
  PaymentRefund,
  VisitReceipt,
} from '@/features/payments/domain/entities/payments.entities';

/** Hospital payments (H9): payment lines, their refunds, visit receipts and the export. */
export interface PaymentsRepository {
  listPayments(query: PaymentPageQuery): Promise<Result<Page<PaymentLine>>>;
  /** Every line matching `filters` (all pages, capped) — for the day's totals. */
  listAllPayments(filters: PaymentFilters): Promise<Result<readonly PaymentLine[]>>;
  /** The refunds issued against one payment line. */
  listPaymentRefunds(paymentId: string): Promise<Result<readonly PaymentRefund[]>>;
  listVisitReceipts(visitId: string): Promise<Result<readonly VisitReceipt[]>>;
  /** The server-built CSV, Excel or PDF of every line matching `filters`. */
  exportPayments(
    filters: PaymentFilters,
    format: PaymentExportFormat,
  ): Promise<Result<PaymentExportFile>>;
  /** Every refund in a date window (desk and online). */
  listRefunds(dateFrom: string, dateTo: string): Promise<Result<readonly PaymentRefund[]>>;
  /** The day's cash per staff member: float, cash in, refunds, expected, counted. */
  getCashSummary(date: string): Promise<Result<readonly CashSummaryRow[]>>;

  /** `staffId`'s open cash drawer, or `null` when it is closed. */
  getOpenCashSession(staffId: string): Promise<Result<CashSession | null>>;
  /** Open the signed-in staff member's drawer with a float, at a counter or their default. */
  openCashSession(
    openingFloatPaise: number,
    counterId: string | null,
  ): Promise<Result<CashSession>>;
  /** Close a drawer with the cash counted; the server works out the variance. */
  closeCashSession(
    id: string,
    countedCashPaise: number,
    note: string | null,
  ): Promise<Result<CashSession>>;
  /** Closed drawers waiting for an admin to reconcile, oldest first. */
  listCashSessionsToReconcile(): Promise<Result<readonly CashSession[]>>;
  reconcileCashSession(id: string): Promise<Result<CashSession>>;
}
