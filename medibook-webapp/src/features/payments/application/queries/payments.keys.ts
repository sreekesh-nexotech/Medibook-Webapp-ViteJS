import type {
  PaymentFilters,
  PaymentPageQuery,
} from '@/features/payments/domain/entities/payments.entities';

/** Query keys for hospital payments (H9) — standards §4, no inline key arrays. */
export const paymentsKeys = {
  all: ['payments'] as const,
  pages: () => [...paymentsKeys.all, 'page'] as const,
  page: (query: PaymentPageQuery) => [...paymentsKeys.pages(), query] as const,
  totals: (filters: PaymentFilters) => [...paymentsKeys.all, 'totals', filters] as const,
  refunds: (paymentId: string) => [...paymentsKeys.all, 'refunds', paymentId] as const,
  visitReceipts: (visitId: string) => [...paymentsKeys.all, 'visit-receipts', visitId] as const,
};

/** Money moves all day at the desk; re-read every 30 s. */
export const PAYMENTS_STALE_TIME_MS = 30_000;
