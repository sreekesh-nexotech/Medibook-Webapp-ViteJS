import type { Result } from '@/core/error/failure';

import type { PlatformUserStatus } from '@/features/ops-platform-users/domain/entities/platformUsers.entities';
import { platformUsersRepository } from '@/features/ops-platform-users/infrastructure/repositories/platformUsers.repository.impl';

export function countPlatformUsers(status: PlatformUserStatus | null): Promise<Result<number>> {
  return platformUsersRepository.countUsers(status);
}
