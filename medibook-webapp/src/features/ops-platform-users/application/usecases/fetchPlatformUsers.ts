import type { Page } from '@/core/api/pagination';
import type { Result } from '@/core/error/failure';

import type {
  PlatformUserListParams,
  PlatformUserSummary,
} from '@/features/ops-platform-users/domain/entities/platformUsers.entities';
import { platformUsersRepository } from '@/features/ops-platform-users/infrastructure/repositories/platformUsers.repository.impl';

export function fetchPlatformUsers(
  params: PlatformUserListParams,
): Promise<Result<Page<PlatformUserSummary>>> {
  return platformUsersRepository.listUsers(params);
}
