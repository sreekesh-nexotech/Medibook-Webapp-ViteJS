import { useQueries } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import type { PaymentRefund } from '@/features/payments/domain/entities/payments.entities';
import {
  PAYMENTS_STALE_TIME_MS,
  paymentsKeys,
} from '@/features/payments/application/queries/payments.keys';
import { fetchPayment } from '@/features/payments/application/usecases/fetchPayment';

/**
 * The refunds of each listed line, keyed by payment id — for lines whose
 * refund state the backend does not send on the row (an older backend). A
 * line whose detail has not loaded (or failed to) is simply absent.
 */
export function useLineRefundsQuery(
  paymentIds: readonly string[],
): Readonly<Record<string, readonly PaymentRefund[]>> {
  return useQueries({
    queries: paymentIds.map((id) => ({
      queryKey: paymentsKeys.detail(id),
      queryFn: async () => unwrap(await fetchPayment(id)),
      staleTime: PAYMENTS_STALE_TIME_MS,
    })),
    combine: (results) => {
      const out: Record<string, readonly PaymentRefund[]> = {};
      results.forEach((r, i) => {
        const id = paymentIds[i];
        if (id !== undefined && r.data !== undefined) out[id] = r.data.refunds;
      });
      return out;
    },
  });
}
