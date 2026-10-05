import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { billingKeys } from '@/features/ops-billing/application/queries/billing.keys';
import { rejectPlanChange } from '@/features/ops-billing/application/usecases/rejectPlanChange';

/** Turn down a plan change request. */
export function useRejectPlanChangeMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, note }: { readonly id: string; readonly note: string | null }) =>
      unwrap(await rejectPlanChange(id, note)),
    onSettled: () => queryClient.invalidateQueries({ queryKey: billingKeys.all }),
  });
}
