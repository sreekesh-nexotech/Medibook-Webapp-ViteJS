import type { Result } from '@/core/error/failure';

import type { StaffRole } from '@/features/users-roles/domain/entities/usersRoles.types';
import { usersRolesRepository } from '@/features/users-roles/infrastructure/repositories/usersRoles.repository.impl';

export function fetchStaffRoles(): Promise<Result<readonly StaffRole[]>> {
  return usersRolesRepository.listRoles();
}
