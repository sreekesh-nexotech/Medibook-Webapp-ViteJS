import type {
  PaymentFilters,
  PaymentPageQuery,
  RefundListQuery,
} from '@/features/payments/domain/entities/payments.entities';

/** Query keys for hospital payments (H9) — standards §4, no inline key arrays. */
export const paymentsKeys = {
  all: ['payments'] as const,
  pages: () => [...paymentsKeys.all, 'page'] as const,
  page: (query: PaymentPageQuery) => [...paymentsKeys.pages(), query] as const,
  totals: (filters: PaymentFilters) => [...paymentsKeys.all, 'totals', filters] as const,
  detail: (paymentId: string) => [...paymentsKeys.all, 'detail', paymentId] as const,
  orderLines: (orderId: string) => [...paymentsKeys.all, 'order-lines', orderId] as const,
  refundPage: (query: RefundListQuery) => [...paymentsKeys.all, 'refund-page', query] as const,
  refundsIn: (dateFrom: string, dateTo: string) =>
    [...paymentsKeys.all, 'refunds-in', dateFrom, dateTo] as const,
  visitReceipts: (visitId: string) => [...paymentsKeys.all, 'visit-receipts', visitId] as const,
  cash: () => [...paymentsKeys.all, 'cash'] as const,
  openCash: (staffId: string) => [...paymentsKeys.cash(), 'open', staffId] as const,
  cashToReconcile: () => [...paymentsKeys.cash(), 'to-reconcile'] as const,
  /** `null` = the hospital's own today. */
  cashSummary: (date: string | null) => [...paymentsKeys.cash(), 'summary', date] as const,
  cashActivity: (sessionId: string) => [...paymentsKeys.cash(), 'activity', sessionId] as const,
  counters: () => [...paymentsKeys.cash(), 'counters'] as const,
};

/** Money moves all day at the desk; re-read every 30 s. */
export const PAYMENTS_STALE_TIME_MS = 30_000;

/** Counters are set up once and rarely change. */
export const COUNTERS_STALE_TIME_MS = 10 * 60_000;
