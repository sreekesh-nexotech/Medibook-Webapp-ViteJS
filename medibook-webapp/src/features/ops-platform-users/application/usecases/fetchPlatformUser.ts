import type { Result } from '@/core/error/failure';

import type { PlatformUserDetail } from '@/features/ops-platform-users/domain/entities/platformUsers.entities';
import { platformUsersRepository } from '@/features/ops-platform-users/infrastructure/repositories/platformUsers.repository.impl';

export function fetchPlatformUser(id: string): Promise<Result<PlatformUserDetail>> {
  return platformUsersRepository.getUser(id);
}
