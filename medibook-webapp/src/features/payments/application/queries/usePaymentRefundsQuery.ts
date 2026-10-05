import { useQueries } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import type { PaymentRefund } from '@/features/payments/domain/entities/payments.entities';
import {
  PAYMENTS_STALE_TIME_MS,
  paymentsKeys,
} from '@/features/payments/application/queries/payments.keys';
import { fetchPaymentRefunds } from '@/features/payments/application/usecases/fetchPaymentRefunds';

/**
 * The refunds of each refunded line on the visible page, keyed by payment id.
 * A line whose refunds have not loaded (or failed to) is simply absent.
 */
export function usePaymentRefundsQuery(
  paymentIds: readonly string[],
): Readonly<Record<string, readonly PaymentRefund[]>> {
  return useQueries({
    queries: paymentIds.map((id) => ({
      queryKey: paymentsKeys.refunds(id),
      queryFn: async () => unwrap(await fetchPaymentRefunds(id)),
      staleTime: PAYMENTS_STALE_TIME_MS,
    })),
    combine: (results) => {
      const out: Record<string, readonly PaymentRefund[]> = {};
      results.forEach((r, i) => {
        const id = paymentIds[i];
        if (id !== undefined && r.data !== undefined) out[id] = r.data;
      });
      return out;
    },
  });
}
