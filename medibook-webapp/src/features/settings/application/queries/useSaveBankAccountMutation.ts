import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import type {
  BankAccount,
  BankAccountInput,
} from '@/features/settings/domain/entities/settings.entities';
import { settingsKeys } from '@/features/settings/application/queries/settings.keys';
import { saveBankAccount } from '@/features/settings/application/usecases/saveBankAccount';

interface SaveBankAccountInput {
  readonly input: BankAccountInput;
  /** The account being edited, or `null` to add the first one. */
  readonly existing: BankAccount | null;
}

/** Create or update the payout account. */
export function useSaveBankAccountMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ input, existing }: SaveBankAccountInput) =>
      unwrap(await saveBankAccount(input, existing)),
    onSettled: () => queryClient.invalidateQueries({ queryKey: settingsKeys.bankAccounts() }),
  });
}
