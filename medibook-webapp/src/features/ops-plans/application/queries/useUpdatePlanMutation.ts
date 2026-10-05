import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { plansKeys } from '@/features/ops-plans/application/queries/plans.keys';
import { updatePlan } from '@/features/ops-plans/application/usecases/updatePlan';
import type { CatalogPlanDraft } from '@/features/ops-plans/domain/entities/plans.catalog';

interface UpdatePlanInput {
  readonly planId: string;
  readonly draft: CatalogPlanDraft;
  /** The version the form was opened on; a stale one is refused (409). */
  readonly version: number;
}

/** Edit a plan tier. */
export function useUpdatePlanMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ planId, draft, version }: UpdatePlanInput) =>
      unwrap(await updatePlan(planId, draft, version)),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: plansKeys.list() });
    },
  });
}
