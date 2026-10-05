import type { Result } from '@/core/error/failure';

import type { OpsStaffMember } from '@/features/ops-users/domain/entities/opsUsers.types';
import { opsUsersRepository } from '@/features/ops-users/infrastructure/repositories/opsUsers.repository.impl';

export function changeOpsStaffRole(
  id: string,
  roleId: string,
  version: number,
): Promise<Result<OpsStaffMember>> {
  return opsUsersRepository.changeStaffRole(id, roleId, version);
}
