import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { plansKeys } from '@/features/ops-plans/application/queries/plans.keys';
import { deletePlan } from '@/features/ops-plans/application/usecases/deletePlan';

/** Remove a never-subscribed plan from the catalog. */
export function useDeletePlanMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (planId: string) => unwrap(await deletePlan(planId)),
    onSettled: (_data, _error, planId) => {
      void queryClient.invalidateQueries({ queryKey: plansKeys.list() });
      void queryClient.invalidateQueries({ queryKey: plansKeys.subscriberCount(planId) });
    },
  });
}
