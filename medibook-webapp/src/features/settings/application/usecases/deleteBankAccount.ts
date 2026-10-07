import type { Result } from '@/core/error/failure';

import { settingsRepository } from '@/features/settings/infrastructure/repositories/settings.repository.impl';

export function deleteBankAccount(id: string, version: number): Promise<Result<null>> {
  return settingsRepository.deleteBankAccount(id, version);
}
