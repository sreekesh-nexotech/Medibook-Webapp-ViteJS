import { useState } from 'react';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { opsSettlementsKeys } from '@/features/ops-settlements/application/queries/opsSettlements.keys';
import { releasePayoutRun } from '@/features/ops-settlements/application/usecases/releasePayoutRun';
import type { PayoutRelease } from '@/features/ops-settlements/domain/entities/opsSettlements.entities';

interface ReleasePayoutRunInput {
  readonly runId: string;
  readonly releases: readonly PayoutRelease[];
}

/** Record a whole run's transfers, one UTR per payout. One idempotency key per open form. */
export function useReleasePayoutRunMutation() {
  const queryClient = useQueryClient();
  const [replayKey, setReplayKey] = useState(() => crypto.randomUUID());
  return useMutation({
    mutationFn: async ({ runId, releases }: ReleasePayoutRunInput) =>
      unwrap(await releasePayoutRun(runId, releases, replayKey)),
    onSuccess: () => setReplayKey(crypto.randomUUID()),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: opsSettlementsKeys.all });
    },
  });
}
