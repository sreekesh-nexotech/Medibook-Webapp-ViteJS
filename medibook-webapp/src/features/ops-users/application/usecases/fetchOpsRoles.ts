import type { Result } from '@/core/error/failure';

import type { OpsStaffRole } from '@/features/ops-users/domain/entities/opsUsers.types';
import { opsUsersRepository } from '@/features/ops-users/infrastructure/repositories/opsUsers.repository.impl';

export function fetchOpsRoles(): Promise<Result<readonly OpsStaffRole[]>> {
  return opsUsersRepository.listRoles();
}
