import type { Result } from '@/core/error/failure';

import type {
  StaffRole,
  StaffRoleCode,
} from '@/features/users-roles/domain/entities/usersRoles.types';
import { usersRolesRepository } from '@/features/users-roles/infrastructure/repositories/usersRoles.repository.impl';

export function updateRolePermissions(
  roleCode: StaffRoleCode,
  permissions: readonly string[],
): Promise<Result<StaffRole>> {
  return usersRolesRepository.updateRolePermissions(roleCode, permissions);
}
