import { useState } from 'react';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { opsSettlementsKeys } from '@/features/ops-settlements/application/queries/opsSettlements.keys';
import { addSettlementAdjustment } from '@/features/ops-settlements/application/usecases/addSettlementAdjustment';
import type { AdjustmentDraft } from '@/features/ops-settlements/domain/entities/opsSettlements.entities';

/**
 * Post a settlement adjustment (R2). One idempotency key per open form,
 * rotated on success, so a double submit posts once.
 */
export function useAddAdjustmentMutation() {
  const queryClient = useQueryClient();
  const [replayKey, setReplayKey] = useState(() => crypto.randomUUID());
  return useMutation({
    mutationFn: async (draft: AdjustmentDraft) =>
      unwrap(await addSettlementAdjustment(draft, replayKey)),
    onSuccess: () => setReplayKey(crypto.randomUUID()),
    onSettled: () => {
      // The period's net, its payout and possibly its run's approval change.
      void queryClient.invalidateQueries({ queryKey: opsSettlementsKeys.all });
    },
  });
}
