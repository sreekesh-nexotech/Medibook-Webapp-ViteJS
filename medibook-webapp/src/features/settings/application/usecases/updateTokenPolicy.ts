import type { Result } from '@/core/error/failure';

import type {
  TokenPolicy,
  TokenPolicyChanges,
} from '@/features/settings/domain/entities/settings.entities';
import { settingsRepository } from '@/features/settings/infrastructure/repositories/settings.repository.impl';

export function updateTokenPolicy(
  changes: TokenPolicyChanges,
  version: number,
): Promise<Result<TokenPolicy>> {
  return settingsRepository.updateTokenPolicy(changes, version);
}
