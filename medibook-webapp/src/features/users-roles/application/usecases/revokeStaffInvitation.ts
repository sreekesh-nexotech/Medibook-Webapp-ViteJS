import type { Result } from '@/core/error/failure';

import type { StaffInvitation } from '@/features/users-roles/domain/entities/usersRoles.types';
import { usersRolesRepository } from '@/features/users-roles/infrastructure/repositories/usersRoles.repository.impl';

export function revokeStaffInvitation(invitationId: string): Promise<Result<StaffInvitation>> {
  return usersRolesRepository.revokeInvitation(invitationId);
}
