import type { Result } from '@/core/error/failure';

import type { OpsPermission } from '@/features/ops-users/domain/entities/opsUsers.types';
import { opsUsersRepository } from '@/features/ops-users/infrastructure/repositories/opsUsers.repository.impl';

export function fetchOpsPermissions(): Promise<Result<readonly OpsPermission[]>> {
  return opsUsersRepository.listPermissions();
}
