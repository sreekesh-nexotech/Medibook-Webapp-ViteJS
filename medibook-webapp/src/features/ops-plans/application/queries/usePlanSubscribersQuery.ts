import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { DEFAULT_PAGE_SIZE } from '@/core/api/pagination';
import { unwrap } from '@/core/error/failure';

import { plansKeys } from '@/features/ops-plans/application/queries/plans.keys';
import { fetchPlanSubscribers } from '@/features/ops-plans/application/usecases/fetchPlanSubscribers';

/** Subscriptions move with hospital billing, so re-check sooner than the catalog. */
const SUBSCRIBERS_STALE_TIME_MS = 30_000;

/** One page of the hospitals on a plan (11·R9); idle while no plan is open. */
export function usePlanSubscribersQuery(planId: string | null, page: number) {
  return useQuery({
    queryKey: plansKeys.subscribers(planId ?? '', page),
    queryFn: async () => unwrap(await fetchPlanSubscribers(planId ?? '', page, DEFAULT_PAGE_SIZE)),
    enabled: planId !== null,
    placeholderData: keepPreviousData,
    staleTime: SUBSCRIBERS_STALE_TIME_MS,
  });
}
