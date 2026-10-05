import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { complianceKeys } from '@/features/ops-compliance/application/queries/compliance.keys';
import { rejectComplianceDataRequest } from '@/features/ops-compliance/application/usecases/rejectComplianceDataRequest';

interface RejectInput {
  readonly id: string;
  readonly reason: string;
}

/** Close an open request without exporting, with the reason on record. */
export function useRejectComplianceDataRequestMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: RejectInput) =>
      unwrap(await rejectComplianceDataRequest(id, reason)),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: complianceKeys.requests() });
    },
  });
}
