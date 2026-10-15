import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { complianceKeys } from '@/features/ops-compliance/application/queries/compliance.keys';
import { processComplianceDataRequest } from '@/features/ops-compliance/application/usecases/processComplianceDataRequest';

/** What to process: a request, plus notes when completing a rectification. */
export interface ProcessDataRequestInput {
  readonly id: string;
  readonly notes?: string;
}

/**
 * Prepare a filed request's export now (or learn that the nightly run will),
 * or complete a rectification with notes. Refreshes the register and details.
 */
export function useProcessComplianceDataRequestMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, notes }: ProcessDataRequestInput) =>
      unwrap(await processComplianceDataRequest(id, notes)),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: complianceKeys.requests() });
    },
  });
}
