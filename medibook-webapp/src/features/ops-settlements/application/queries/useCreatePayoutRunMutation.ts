import { useState } from 'react';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { opsSettlementsKeys } from '@/features/ops-settlements/application/queries/opsSettlements.keys';
import { createPayoutRun } from '@/features/ops-settlements/application/usecases/createPayoutRun';
import type { PayoutRunDraft } from '@/features/ops-settlements/domain/entities/opsSettlements.entities';

/**
 * Create a draft payout run over a window; it gathers every closed, unpaid
 * period inside it. One idempotency key per open form, rotated on success.
 */
export function useCreatePayoutRunMutation() {
  const queryClient = useQueryClient();
  const [replayKey, setReplayKey] = useState(() => crypto.randomUUID());
  return useMutation({
    mutationFn: async (draft: PayoutRunDraft) => unwrap(await createPayoutRun(draft, replayKey)),
    onSuccess: () => setReplayKey(crypto.randomUUID()),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: opsSettlementsKeys.all });
    },
  });
}
