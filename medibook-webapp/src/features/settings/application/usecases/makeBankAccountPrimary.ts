import type { Result } from '@/core/error/failure';

import type { BankAccount } from '@/features/settings/domain/entities/settings.entities';
import { settingsRepository } from '@/features/settings/infrastructure/repositories/settings.repository.impl';

export function makeBankAccountPrimary(id: string): Promise<Result<BankAccount>> {
  return settingsRepository.makeBankAccountPrimary(id);
}
