import { useState } from 'react';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { opsSettlementsKeys } from '@/features/ops-settlements/application/queries/opsSettlements.keys';
import { commandPayout } from '@/features/ops-settlements/application/usecases/commandPayout';
import type { PayoutCommand } from '@/features/ops-settlements/domain/entities/opsSettlements.entities';

interface PayoutCommandInput {
  readonly payoutId: string;
  readonly command: PayoutCommand;
  readonly reason: string;
}

/** Hold or fail a payout (R3). One idempotency key per open dialog, rotated on success. */
export function usePayoutCommandMutation() {
  const queryClient = useQueryClient();
  const [replayKey, setReplayKey] = useState(() => crypto.randomUUID());
  return useMutation({
    mutationFn: async ({ payoutId, command, reason }: PayoutCommandInput) =>
      unwrap(await commandPayout(payoutId, command, reason, replayKey)),
    onSuccess: () => setReplayKey(crypto.randomUUID()),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: opsSettlementsKeys.all });
    },
  });
}
