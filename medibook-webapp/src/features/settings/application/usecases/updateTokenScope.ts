import type { Result } from '@/core/error/failure';

import type {
  TokenPolicy,
  TokenScope,
} from '@/features/settings/domain/entities/settings.entities';
import { settingsRepository } from '@/features/settings/infrastructure/repositories/settings.repository.impl';

export function updateTokenScope(scope: TokenScope, version: number): Promise<Result<TokenPolicy>> {
  return settingsRepository.updateTokenScope(scope, version);
}
