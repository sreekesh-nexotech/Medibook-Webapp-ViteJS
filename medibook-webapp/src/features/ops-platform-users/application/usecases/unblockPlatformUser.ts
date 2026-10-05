import type { Result } from '@/core/error/failure';

import type { PlatformUserSummary } from '@/features/ops-platform-users/domain/entities/platformUsers.entities';
import { platformUsersRepository } from '@/features/ops-platform-users/infrastructure/repositories/platformUsers.repository.impl';

export function unblockPlatformUser(id: string): Promise<Result<PlatformUserSummary>> {
  return platformUsersRepository.unblockUser(id);
}
