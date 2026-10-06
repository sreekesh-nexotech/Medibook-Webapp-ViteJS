import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import {
  PAYMENTS_STALE_TIME_MS,
  paymentsKeys,
} from '@/features/payments/application/queries/payments.keys';
import { fetchCashSessionsToReconcile } from '@/features/payments/application/usecases/fetchCashSessionsToReconcile';

/** Closed drawers waiting for an admin. Pass `enabled: false` for roles that cannot reconcile. */
export function useCashSessionsToReconcileQuery(enabled: boolean) {
  return useQuery({
    queryKey: paymentsKeys.cashToReconcile(),
    queryFn: async () => unwrap(await fetchCashSessionsToReconcile()),
    enabled,
    staleTime: PAYMENTS_STALE_TIME_MS,
  });
}
