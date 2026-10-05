import type { Page } from '@/core/api/pagination';
import type { Result } from '@/core/error/failure';

import type {
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
  /** The server-built CSV of every line matching `filters`. */
  exportCsv(filters: PaymentFilters): Promise<Result<string>>;
}
