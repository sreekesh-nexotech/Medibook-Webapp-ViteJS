import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { billingKeys } from '@/features/settlements/application/queries/billing.keys';
import { fetchBillingPlans } from '@/features/settlements/application/usecases/fetchBillingPlans';

/** The public catalogue is edited by Medibook operations, rarely. */
const PLANS_STALE_TIME_MS = 10 * 60_000;

/** Public, active plans — loaded only while the request form needs them. */
export function useBillingPlansQuery(enabled: boolean) {
  return useQuery({
    queryKey: billingKeys.plans(),
    queryFn: async () => unwrap(await fetchBillingPlans()),
    enabled,
    staleTime: PLANS_STALE_TIME_MS,
  });
}
