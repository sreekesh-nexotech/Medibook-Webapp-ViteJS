import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import type { PlanChangeInput } from '@/features/settlements/domain/entities/billing.entities';
import { billingKeys } from '@/features/settlements/application/queries/billing.keys';
import { requestPlanChange } from '@/features/settlements/application/usecases/requestPlanChange';

/** Ask Medibook operations to move the hospital to another plan. */
export function useRequestPlanChangeMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: PlanChangeInput) => unwrap(await requestPlanChange(input)),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: billingKeys.planChangeRequests() });
    },
  });
}
