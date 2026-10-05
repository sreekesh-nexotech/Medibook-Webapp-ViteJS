import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { plansKeys } from '@/features/ops-plans/application/queries/plans.keys';
import { createPlan } from '@/features/ops-plans/application/usecases/createPlan';
import type { CatalogPlanDraft } from '@/features/ops-plans/domain/entities/plans.catalog';

/** Add a plan tier to the catalog. */
export function useCreatePlanMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (draft: CatalogPlanDraft) => unwrap(await createPlan(draft)),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: plansKeys.list() });
    },
  });
}
