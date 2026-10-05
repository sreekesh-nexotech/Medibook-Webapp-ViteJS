import type { Result } from '@/core/error/failure';

import type { BankAccount } from '@/features/settings/domain/entities/settings.entities';
import { settingsRepository } from '@/features/settings/infrastructure/repositories/settings.repository.impl';

export function fetchBankAccounts(): Promise<Result<readonly BankAccount[]>> {
  return settingsRepository.listBankAccounts();
}
