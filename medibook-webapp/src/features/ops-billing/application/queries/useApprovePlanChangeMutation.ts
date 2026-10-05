import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { billingKeys } from '@/features/ops-billing/application/queries/billing.keys';
import { approvePlanChange } from '@/features/ops-billing/application/usecases/approvePlanChange';

/** Approve a plan change: it applies at once, with proration. */
export function useApprovePlanChangeMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => unwrap(await approvePlanChange(id)),
    onSettled: () => queryClient.invalidateQueries({ queryKey: billingKeys.all }),
  });
}
