import type { Result } from '@/core/error/failure';

import type { TokenPolicy } from '@/features/settings/domain/entities/settings.entities';
import { settingsRepository } from '@/features/settings/infrastructure/repositories/settings.repository.impl';

export function fetchTokenPolicy(): Promise<Result<TokenPolicy>> {
  return settingsRepository.getTokenPolicy();
}
