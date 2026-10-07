import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { hospitalsKeys } from '@/features/ops-hospitals/application/queries/hospitals.keys';
import { verifyBankAccount } from '@/features/ops-hospitals/application/usecases/verifyBankAccount';

interface VerifyBankAccountInput {
  readonly hospitalId: string;
  readonly accountId: string;
  readonly version: number;
}

/**
 * Record that platform finance verified a payout account (M-45). Payout runs
 * skip unverified primaries, so the hospital detail (its go-live blockers and
 * payout account) is re-read too.
 */
export function useVerifyBankAccountMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ hospitalId, accountId, version }: VerifyBankAccountInput) =>
      unwrap(await verifyBankAccount(hospitalId, accountId, version)),
    onSettled: (_data, _error, { hospitalId }) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: hospitalsKeys.bankAccounts(hospitalId) }),
        queryClient.invalidateQueries({ queryKey: hospitalsKeys.detail(hospitalId) }),
      ]),
  });
}
