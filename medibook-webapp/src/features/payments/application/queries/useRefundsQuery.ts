import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import {
  PAYMENTS_STALE_TIME_MS,
  paymentsKeys,
} from '@/features/payments/application/queries/payments.keys';
import { fetchRefunds } from '@/features/payments/application/usecases/fetchRefunds';

/** Every refund in a date window — the KPI strip's refunded figure. */
export function useRefundsQuery(dateFrom: string, dateTo: string) {
  return useQuery({
    queryKey: paymentsKeys.refundsIn(dateFrom, dateTo),
    queryFn: async () => unwrap(await fetchRefunds(dateFrom, dateTo)),
    staleTime: PAYMENTS_STALE_TIME_MS,
  });
}
