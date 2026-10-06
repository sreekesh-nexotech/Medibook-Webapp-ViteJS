import type { Result } from '@/core/error/failure';

import type { StaffCounter } from '@/features/users-roles/domain/entities/usersRoles.types';
import { usersRolesRepository } from '@/features/users-roles/infrastructure/repositories/usersRoles.repository.impl';

export function fetchStaffCounters(): Promise<Result<readonly StaffCounter[]>> {
  return usersRolesRepository.listCounters();
}
