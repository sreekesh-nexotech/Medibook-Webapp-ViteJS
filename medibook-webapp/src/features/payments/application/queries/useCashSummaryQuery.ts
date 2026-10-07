import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import {
  PAYMENTS_STALE_TIME_MS,
  paymentsKeys,
} from '@/features/payments/application/queries/payments.keys';
import { fetchCashSummary } from '@/features/payments/application/usecases/fetchCashSummary';

/**
 * The day's cash per staff member; `date` `null` asks for the hospital's own
 * today (not the device's, F26). Idle when `enabled` is false.
 */
export function useCashSummaryQuery(date: string | null, enabled: boolean) {
  return useQuery({
    queryKey: paymentsKeys.cashSummary(date),
    queryFn: async () => unwrap(await fetchCashSummary(date)),
    enabled,
    staleTime: PAYMENTS_STALE_TIME_MS,
  });
}
