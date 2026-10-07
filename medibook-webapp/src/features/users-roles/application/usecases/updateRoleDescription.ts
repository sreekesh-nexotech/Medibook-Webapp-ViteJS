import type { Result } from '@/core/error/failure';

import type {
  StaffRole,
  StaffRoleCode,
} from '@/features/users-roles/domain/entities/usersRoles.types';
import { usersRolesRepository } from '@/features/users-roles/infrastructure/repositories/usersRoles.repository.impl';

export function updateRoleDescription(
  roleCode: StaffRoleCode,
  description: string | null,
  version: number,
): Promise<Result<StaffRole>> {
  return usersRolesRepository.updateRoleDescription(roleCode, description, version);
}
