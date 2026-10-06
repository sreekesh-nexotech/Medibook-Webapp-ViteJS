import type { Result } from '@/core/error/failure';

import type {
  StaffDetailsDraft,
  StaffMember,
} from '@/features/users-roles/domain/entities/usersRoles.types';
import { usersRolesRepository } from '@/features/users-roles/infrastructure/repositories/usersRoles.repository.impl';

export function updateStaffDetails(
  staffId: string,
  details: StaffDetailsDraft,
  version: number,
): Promise<Result<StaffMember>> {
  return usersRolesRepository.updateStaffDetails(staffId, details, version);
}
