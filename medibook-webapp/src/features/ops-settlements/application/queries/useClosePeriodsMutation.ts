import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { opsSettlementsKeys } from '@/features/ops-settlements/application/queries/opsSettlements.keys';
import { closeSettlementPeriods } from '@/features/ops-settlements/application/usecases/closeSettlementPeriods';
import type { PeriodCloseRequest } from '@/features/ops-settlements/domain/entities/opsSettlements.entities';

interface ClosePeriodsInput {
  readonly request: PeriodCloseRequest;
  /** `false`: dry run only; `true`: close. */
  readonly confirm: boolean;
}

/** Preview, then close, settlement periods (BE-27, UAT 09·F1). */
export function useClosePeriodsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ request, confirm }: ClosePeriodsInput) =>
      unwrap(await closeSettlementPeriods(request, confirm)),
    onSuccess: (outcome) => {
      if (outcome.kind === 'closed') {
        void queryClient.invalidateQueries({ queryKey: opsSettlementsKeys.all });
      }
    },
  });
}
