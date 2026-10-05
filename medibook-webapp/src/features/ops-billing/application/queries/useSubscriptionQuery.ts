import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { SUBSCRIPTION_STALE_TIME_MS } from '@/features/ops-billing/application/queries/billing.config';
import { billingKeys } from '@/features/ops-billing/application/queries/billing.keys';
import { fetchSubscription } from '@/features/ops-billing/application/usecases/fetchSubscription';

/** The subscription an invoice bills: plan name and the hospital's grace override. */
export function useSubscriptionQuery(id: string | undefined) {
  return useQuery({
    queryKey: billingKeys.subscription(id ?? ''),
    queryFn: async () => unwrap(await fetchSubscription(id ?? '')),
    enabled: Boolean(id),
    staleTime: SUBSCRIPTION_STALE_TIME_MS,
  });
}
