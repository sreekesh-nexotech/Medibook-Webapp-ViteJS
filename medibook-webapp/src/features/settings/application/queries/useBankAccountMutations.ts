import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { settingsKeys } from '@/features/settings/application/queries/settings.keys';
import { deleteBankAccount } from '@/features/settings/application/usecases/deleteBankAccount';
import { makeBankAccountPrimary } from '@/features/settings/application/usecases/makeBankAccountPrimary';

interface DeleteBankAccountInput {
  readonly id: string;
  readonly version: number;
}

export function useDeleteBankAccountMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, version }: DeleteBankAccountInput) =>
      unwrap(await deleteBankAccount(id, version)),
    onSettled: () => queryClient.invalidateQueries({ queryKey: settingsKeys.bankAccounts() }),
  });
}

/** Payouts go to the primary account; only the admin role may switch it (decision 4). */
export function useMakeBankAccountPrimaryMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => unwrap(await makeBankAccountPrimary(id)),
    onSettled: () => queryClient.invalidateQueries({ queryKey: settingsKeys.bankAccounts() }),
  });
}
