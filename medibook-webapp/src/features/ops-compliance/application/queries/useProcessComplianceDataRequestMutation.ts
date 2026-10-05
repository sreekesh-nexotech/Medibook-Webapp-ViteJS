import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { complianceKeys } from '@/features/ops-compliance/application/queries/compliance.keys';
import { processComplianceDataRequest } from '@/features/ops-compliance/application/usecases/processComplianceDataRequest';

/** Prepare a filed request's export now (or learn that the nightly run will). */
export function useProcessComplianceDataRequestMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => unwrap(await processComplianceDataRequest(id)),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: complianceKeys.requests() });
    },
  });
}
