import type { Result } from '@/core/error/failure';

import type {
  BankAccount,
  BankAccountInput,
} from '@/features/settings/domain/entities/settings.entities';
import { settingsRepository } from '@/features/settings/infrastructure/repositories/settings.repository.impl';

/** Update `existing` when there is one, otherwise create the hospital's first (primary) account. */
export function saveBankAccount(
  input: BankAccountInput,
  existing: BankAccount | null,
): Promise<Result<BankAccount>> {
  return existing
    ? settingsRepository.updateBankAccount(existing.id, input, existing.version)
    : settingsRepository.createBankAccount(input);
}
