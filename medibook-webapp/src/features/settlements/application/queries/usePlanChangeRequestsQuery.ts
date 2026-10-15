import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { billingKeys } from '@/features/settlements/application/queries/billing.keys';
import { fetchPlanChangeRequests } from '@/features/settlements/application/usecases/fetchPlanChangeRequests';

/** Operations review requests within hours; a minute keeps the banner current. */
const PLAN_CHANGE_STALE_TIME_MS = 60_000;

/** The hospital's plan change requests, newest first. Needs `billing_settlements.view` (decision 13). */
export function usePlanChangeRequestsQuery(enabled: boolean) {
  return useQuery({
    queryKey: billingKeys.planChangeRequests(),
    queryFn: async () => unwrap(await fetchPlanChangeRequests()),
    enabled,
    staleTime: PLAN_CHANGE_STALE_TIME_MS,
  });
}
