import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { BILLING_STALE_TIME_MS } from '@/features/ops-billing/application/queries/billing.config';
import { billingKeys } from '@/features/ops-billing/application/queries/billing.keys';
import { fetchBillingSummary } from '@/features/ops-billing/application/usecases/fetchBillingSummary';

/** MRR, outstanding and collected (BE-28); `data === null` on a backend without it. */
export function useBillingSummaryQuery() {
  return useQuery({
    queryKey: billingKeys.summary(),
    queryFn: async () => unwrap(await fetchBillingSummary()),
    staleTime: BILLING_STALE_TIME_MS,
  });
}
