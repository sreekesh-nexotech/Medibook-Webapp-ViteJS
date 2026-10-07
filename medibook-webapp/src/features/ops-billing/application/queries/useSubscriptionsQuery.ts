import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import type { SubscriptionListParams } from '@/features/ops-billing/domain/entities/billing.entities';
import { BILLING_STALE_TIME_MS } from '@/features/ops-billing/application/queries/billing.config';
import { billingKeys } from '@/features/ops-billing/application/queries/billing.keys';
import { fetchSubscriptions } from '@/features/ops-billing/application/usecases/fetchSubscriptions';

/** Hospitals' subscriptions, newest first (`billing.view`). */
export function useSubscriptionsQuery(params: SubscriptionListParams, enabled = true) {
  return useQuery({
    queryKey: billingKeys.subscriptions(params),
    queryFn: async () => unwrap(await fetchSubscriptions(params)),
    placeholderData: keepPreviousData,
    staleTime: BILLING_STALE_TIME_MS,
    enabled,
  });
}
