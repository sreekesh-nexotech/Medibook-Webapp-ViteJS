import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import type { DunningListParams } from '@/features/ops-billing/domain/entities/billing.entities';
import { BILLING_STALE_TIME_MS } from '@/features/ops-billing/application/queries/billing.config';
import { billingKeys } from '@/features/ops-billing/application/queries/billing.keys';
import { fetchDunningEvents } from '@/features/ops-billing/application/usecases/fetchDunningEvents';

/** The dunning timeline (reminders, grace, read-only, reinstatement), newest first. */
export function useDunningQuery(params: DunningListParams, enabled = true) {
  return useQuery({
    queryKey: billingKeys.dunning(params),
    queryFn: async () => unwrap(await fetchDunningEvents(params)),
    placeholderData: keepPreviousData,
    staleTime: BILLING_STALE_TIME_MS,
    enabled,
  });
}
