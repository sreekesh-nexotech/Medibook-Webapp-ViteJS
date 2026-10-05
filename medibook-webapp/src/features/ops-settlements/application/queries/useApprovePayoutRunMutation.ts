import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { opsSettlementsKeys } from '@/features/ops-settlements/application/queries/opsSettlements.keys';
import { approvePayoutRun } from '@/features/ops-settlements/application/usecases/approvePayoutRun';

/** Approve a draft payout run so its payouts can be released. */
export function useApprovePayoutRunMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (runId: string) => unwrap(await approvePayoutRun(runId)),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: opsSettlementsKeys.all });
    },
  });
}
