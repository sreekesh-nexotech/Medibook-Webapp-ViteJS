import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import type { BillingPeriod } from '@/features/ops-billing/domain/entities/billing.entities';
import { billingKeys } from '@/features/ops-billing/application/queries/billing.keys';
import { previewSubscriptionChange } from '@/features/ops-billing/application/usecases/previewSubscriptionChange';

/** What changing to `planId` / `billingPeriod` would issue now (no writes); `null` = unavailable. */
export function useSubscriptionPreviewQuery(
  id: string,
  planId: string | null,
  billingPeriod: BillingPeriod | null,
  enabled: boolean,
) {
  return useQuery({
    queryKey: billingKeys.subscriptionPreview(id, planId, billingPeriod),
    queryFn: async () => unwrap(await previewSubscriptionChange(id, planId, billingPeriod)),
    enabled,
    staleTime: 0,
  });
}
