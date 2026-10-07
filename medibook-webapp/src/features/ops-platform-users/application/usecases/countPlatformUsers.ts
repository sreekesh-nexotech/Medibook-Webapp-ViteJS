import type { Result } from '@/core/error/failure';

import type { PlatformUserCountFilter } from '@/features/ops-platform-users/domain/entities/platformUsers.entities';
import { platformUsersRepository } from '@/features/ops-platform-users/infrastructure/repositories/platformUsers.repository.impl';

export function countPlatformUsers(filter: PlatformUserCountFilter): Promise<Result<number>> {
  return platformUsersRepository.countUsers(filter);
}
