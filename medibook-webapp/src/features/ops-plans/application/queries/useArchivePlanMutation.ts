import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { plansKeys } from '@/features/ops-plans/application/queries/plans.keys';
import { archivePlan } from '@/features/ops-plans/application/usecases/archivePlan';

/** Close a plan to new subscriptions; its current subscribers keep it. */
export function useArchivePlanMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (planId: string) => unwrap(await archivePlan(planId)),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: plansKeys.list() });
    },
  });
}
