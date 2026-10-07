import type { Result } from '@/core/error/failure';

import type {
  OpsRoleChanges,
  OpsStaffRole,
} from '@/features/ops-users/domain/entities/opsUsers.types';
import { opsUsersRepository } from '@/features/ops-users/infrastructure/repositories/opsUsers.repository.impl';

export function updateOpsRole(
  id: string,
  changes: OpsRoleChanges,
  version: number,
): Promise<Result<OpsStaffRole>> {
  return opsUsersRepository.updateRole(id, changes, version);
}
