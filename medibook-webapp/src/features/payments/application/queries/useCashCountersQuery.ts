import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import {
  COUNTERS_STALE_TIME_MS,
  paymentsKeys,
} from '@/features/payments/application/queries/payments.keys';
import { fetchCashCounters } from '@/features/payments/application/usecases/fetchCashCounters';

/** The counters a drawer may be opened at. Idle when `enabled` is false. */
export function useCashCountersQuery(enabled: boolean) {
  return useQuery({
    queryKey: paymentsKeys.counters(),
    queryFn: async () => unwrap(await fetchCashCounters()),
    enabled,
    staleTime: COUNTERS_STALE_TIME_MS,
  });
}
