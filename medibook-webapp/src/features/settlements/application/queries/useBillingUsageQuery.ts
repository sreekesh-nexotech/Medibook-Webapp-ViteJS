import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { billingKeys } from '@/features/settlements/application/queries/billing.keys';
import { fetchBillingUsage } from '@/features/settlements/application/usecases/fetchBillingUsage';

/** Usage moves as staff and doctors are added; a minute is fresh enough. */
const USAGE_STALE_TIME_MS = 60_000;

export function useBillingUsageQuery() {
  return useQuery({
    queryKey: billingKeys.usage(),
    queryFn: async () => unwrap(await fetchBillingUsage()),
    staleTime: USAGE_STALE_TIME_MS,
  });
}
