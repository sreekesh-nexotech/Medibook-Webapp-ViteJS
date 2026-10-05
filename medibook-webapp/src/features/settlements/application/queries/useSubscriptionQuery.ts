import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { billingKeys } from '@/features/settlements/application/queries/billing.keys';
import { fetchSubscription } from '@/features/settlements/application/usecases/fetchSubscription';

/** The plan changes rarely; five minutes keeps the tab switch instant. */
const SUBSCRIPTION_STALE_TIME_MS = 5 * 60_000;

export function useSubscriptionQuery() {
  return useQuery({
    queryKey: billingKeys.subscription(),
    queryFn: async () => unwrap(await fetchSubscription()),
    staleTime: SUBSCRIPTION_STALE_TIME_MS,
  });
}
