import type { Result } from '@/core/error/failure';

import type {
  RolePreview,
  StaffRoleCode,
} from '@/features/users-roles/domain/entities/usersRoles.types';
import { usersRolesRepository } from '@/features/users-roles/infrastructure/repositories/usersRoles.repository.impl';

export function fetchRolePreview(roleCode: StaffRoleCode): Promise<Result<RolePreview>> {
  return usersRolesRepository.previewRole(roleCode);
}
