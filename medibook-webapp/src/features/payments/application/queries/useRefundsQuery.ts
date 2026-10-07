import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import {
  PAYMENTS_STALE_TIME_MS,
  paymentsKeys,
} from '@/features/payments/application/queries/payments.keys';
import { fetchRefundsInWindow } from '@/features/payments/application/usecases/fetchRefundsInWindow';

/** Every refund requested in a date window — the KPI strip's refunded figure. */
export function useRefundsQuery(dateFrom: string, dateTo: string) {
  return useQuery({
    queryKey: paymentsKeys.refundsIn(dateFrom, dateTo),
    queryFn: async () => unwrap(await fetchRefundsInWindow(dateFrom, dateTo)),
    staleTime: PAYMENTS_STALE_TIME_MS,
  });
}
