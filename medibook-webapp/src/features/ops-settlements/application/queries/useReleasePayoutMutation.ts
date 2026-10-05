import { useState } from 'react';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { opsSettlementsKeys } from '@/features/ops-settlements/application/queries/opsSettlements.keys';
import { releasePayout } from '@/features/ops-settlements/application/usecases/releasePayout';
import type { PayoutRelease } from '@/features/ops-settlements/domain/entities/opsSettlements.entities';

/** Record one payout's transfer (also re-releases a failed or held payout). */
export function useReleasePayoutMutation() {
  const queryClient = useQueryClient();
  const [replayKey, setReplayKey] = useState(() => crypto.randomUUID());
  return useMutation({
    mutationFn: async (release: PayoutRelease) => unwrap(await releasePayout(release, replayKey)),
    onSuccess: () => setReplayKey(crypto.randomUUID()),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: opsSettlementsKeys.all });
    },
  });
}
