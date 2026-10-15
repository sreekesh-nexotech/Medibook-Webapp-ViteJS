import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { plansKeys } from '@/features/ops-plans/application/queries/plans.keys';
import { unarchivePlan } from '@/features/ops-plans/application/usecases/unarchivePlan';

interface UnarchivePlanInput {
  readonly planId: string;
  /** Guards the fallback edit on a backend without `…/unarchive`. */
  readonly version: number;
}

/** Re-open an archived plan to new subscriptions (UAT-57). */
export function useUnarchivePlanMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ planId, version }: UnarchivePlanInput) =>
      unwrap(await unarchivePlan(planId, version)),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: plansKeys.list() });
    },
  });
}
