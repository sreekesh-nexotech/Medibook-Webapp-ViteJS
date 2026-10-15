import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { invalidateAfterBillingChange } from '@/features/ops-billing/application/queries/billing.keys';
import { approvePlanChange } from '@/features/ops-billing/application/usecases/approvePlanChange';

/**
 * Approve a plan change: it applies at once, with proration. The answer names
 * the proration invoice or credit note it issued (UAT-57).
 */
export function useApprovePlanChangeMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => unwrap(await approvePlanChange(id)),
    onSettled: () => invalidateAfterBillingChange(queryClient),
  });
}
