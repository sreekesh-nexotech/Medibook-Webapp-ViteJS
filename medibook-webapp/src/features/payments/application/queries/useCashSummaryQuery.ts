import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import {
  PAYMENTS_STALE_TIME_MS,
  paymentsKeys,
} from '@/features/payments/application/queries/payments.keys';
import { fetchCashSummary } from '@/features/payments/application/usecases/fetchCashSummary';

/** The day's cash per staff member. Idle when `enabled` is false. */
export function useCashSummaryQuery(date: string, enabled: boolean) {
  return useQuery({
    queryKey: paymentsKeys.cashSummary(date),
    queryFn: async () => unwrap(await fetchCashSummary(date)),
    enabled,
    staleTime: PAYMENTS_STALE_TIME_MS,
  });
}
