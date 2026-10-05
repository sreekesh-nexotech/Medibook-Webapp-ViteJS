import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { plansKeys } from '@/features/ops-plans/application/queries/plans.keys';
import { fetchPlanSubscriberCount } from '@/features/ops-plans/application/usecases/fetchPlanSubscriberCount';

/** Subscriptions move with hospital billing, so re-check sooner than the catalog. */
const SUBSCRIBER_COUNT_STALE_TIME_MS = 30_000;

/** How many hospitals are on one plan. */
export function usePlanSubscriberCountQuery(planId: string) {
  return useQuery({
    queryKey: plansKeys.subscriberCount(planId),
    queryFn: async () => unwrap(await fetchPlanSubscriberCount(planId)),
    staleTime: SUBSCRIBER_COUNT_STALE_TIME_MS,
  });
}
