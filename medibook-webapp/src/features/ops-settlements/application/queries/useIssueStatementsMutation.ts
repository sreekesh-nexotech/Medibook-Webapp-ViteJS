import { useState } from 'react';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { opsSettlementsKeys } from '@/features/ops-settlements/application/queries/opsSettlements.keys';
import { issueStatements } from '@/features/ops-settlements/application/usecases/issueStatements';

/** Issue a month's statements (`billing.edit`). One idempotency key per open dialog. */
export function useIssueStatementsMutation() {
  const queryClient = useQueryClient();
  const [replayKey, setReplayKey] = useState(() => crypto.randomUUID());
  return useMutation({
    mutationFn: async (month: string) => unwrap(await issueStatements(month, replayKey)),
    onSuccess: () => setReplayKey(crypto.randomUUID()),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: opsSettlementsKeys.all });
    },
  });
}
