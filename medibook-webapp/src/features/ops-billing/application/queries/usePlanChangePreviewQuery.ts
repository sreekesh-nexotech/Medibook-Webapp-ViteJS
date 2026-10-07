import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { billingKeys } from '@/features/ops-billing/application/queries/billing.keys';
import { previewPlanChange } from '@/features/ops-billing/application/usecases/previewPlanChange';

/** What approving a plan-change request would issue now (no writes); `null` = unavailable. */
export function usePlanChangePreviewQuery(id: string | null) {
  return useQuery({
    queryKey: billingKeys.planChangePreview(id ?? ''),
    queryFn: async () => unwrap(await previewPlanChange(id ?? '')),
    enabled: id !== null,
    staleTime: 0,
  });
}
