import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import {
  PAYMENTS_STALE_TIME_MS,
  paymentsKeys,
} from '@/features/payments/application/queries/payments.keys';
import { fetchPayment } from '@/features/payments/application/usecases/fetchPayment';

/** One line with every refund against it. `null` stays idle. */
export function usePaymentDetailQuery(paymentId: string | null) {
  return useQuery({
    queryKey: paymentsKeys.detail(paymentId ?? ''),
    queryFn: async () => unwrap(await fetchPayment(paymentId ?? '')),
    enabled: paymentId !== null,
    staleTime: PAYMENTS_STALE_TIME_MS,
  });
}
