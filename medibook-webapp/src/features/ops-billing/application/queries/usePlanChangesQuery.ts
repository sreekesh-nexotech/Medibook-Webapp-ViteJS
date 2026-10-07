import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import type { PlanChangeListParams } from '@/features/ops-billing/domain/entities/billing.entities';
import { BILLING_STALE_TIME_MS } from '@/features/ops-billing/application/queries/billing.config';
import { billingKeys } from '@/features/ops-billing/application/queries/billing.keys';
import { fetchPlanChanges } from '@/features/ops-billing/application/usecases/fetchPlanChanges';

/** Hospitals' plan-change requests, newest first. */
export function usePlanChangesQuery(params: PlanChangeListParams, enabled = true) {
  return useQuery({
    enabled,
    queryKey: billingKeys.planChanges(params),
    queryFn: async () => unwrap(await fetchPlanChanges(params)),
    placeholderData: keepPreviousData,
    staleTime: BILLING_STALE_TIME_MS,
  });
}
