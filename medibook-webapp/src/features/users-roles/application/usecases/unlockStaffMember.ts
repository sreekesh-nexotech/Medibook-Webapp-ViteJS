import type { Result } from '@/core/error/failure';

import type { StaffMember } from '@/features/users-roles/domain/entities/usersRoles.types';
import { usersRolesRepository } from '@/features/users-roles/infrastructure/repositories/usersRoles.repository.impl';

export function unlockStaffMember(staffId: string): Promise<Result<StaffMember>> {
  return usersRolesRepository.unlockStaff(staffId);
}
