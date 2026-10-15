import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import {
  PAYMENTS_STALE_TIME_MS,
  paymentsKeys,
} from '@/features/payments/application/queries/payments.keys';
import { fetchCashSessionActivity } from '@/features/payments/application/usecases/fetchCashSessionActivity';

interface DrawerRef {
  readonly id: string;
  readonly businessDate: string;
}

/** The cash payments and refunds of one drawer. `null` stays idle. */
export function useCashSessionActivityQuery(drawer: DrawerRef | null) {
  return useQuery({
    queryKey: paymentsKeys.cashActivity(drawer?.id ?? ''),
    queryFn: async () =>
      unwrap(await fetchCashSessionActivity(drawer?.id ?? '', drawer?.businessDate ?? '')),
    enabled: drawer !== null,
    staleTime: PAYMENTS_STALE_TIME_MS,
  });
}
