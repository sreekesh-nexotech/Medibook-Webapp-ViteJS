import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import {
  PAYMENTS_STALE_TIME_MS,
  paymentsKeys,
} from '@/features/payments/application/queries/payments.keys';
import { fetchOrderLines } from '@/features/payments/application/usecases/fetchOrderLines';

/** Every line of one payment order — what refunding its booking covers. `null` stays idle. */
export function useOrderLinesQuery(orderId: string | null, bookingRef: string | null) {
  return useQuery({
    queryKey: paymentsKeys.orderLines(orderId ?? ''),
    queryFn: async () => unwrap(await fetchOrderLines(orderId ?? '', bookingRef)),
    enabled: orderId !== null,
    staleTime: PAYMENTS_STALE_TIME_MS,
  });
}
