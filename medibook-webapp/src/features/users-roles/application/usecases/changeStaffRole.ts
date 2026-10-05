import type { Result } from '@/core/error/failure';

import type {
  StaffMember,
  StaffRoleCode,
} from '@/features/users-roles/domain/entities/usersRoles.types';
import { usersRolesRepository } from '@/features/users-roles/infrastructure/repositories/usersRoles.repository.impl';

export function changeStaffRole(
  staffId: string,
  roleCode: StaffRoleCode,
  version: number,
): Promise<Result<StaffMember>> {
  return usersRolesRepository.changeStaffRole(staffId, roleCode, version);
}
