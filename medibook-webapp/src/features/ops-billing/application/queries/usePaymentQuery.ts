import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { BILLING_STALE_TIME_MS } from '@/features/ops-billing/application/queries/billing.config';
import { billingKeys } from '@/features/ops-billing/application/queries/billing.keys';
import { fetchPayment } from '@/features/ops-billing/application/usecases/fetchPayment';

/** One subscription payment by id (BE-28). */
export function usePaymentQuery(id: string) {
  return useQuery({
    queryKey: billingKeys.payment(id),
    queryFn: async () => unwrap(await fetchPayment(id)),
    enabled: Boolean(id),
    staleTime: BILLING_STALE_TIME_MS,
  });
}
