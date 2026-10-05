import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { plansKeys } from '@/features/ops-plans/application/queries/plans.keys';
import { fetchPlans } from '@/features/ops-plans/application/usecases/fetchPlans';

/** The catalog changes rarely and only from this screen, which invalidates on write. */
const PLANS_STALE_TIME_MS = 60_000;

/** Every plan tier in the platform catalog. */
export function usePlansQuery() {
  return useQuery({
    queryKey: plansKeys.list(),
    queryFn: async () => unwrap(await fetchPlans()),
    staleTime: PLANS_STALE_TIME_MS,
  });
}
