import type { Result } from '@/core/error/failure';

import type { PermissionModule } from '@/features/users-roles/domain/entities/usersRoles.types';
import { usersRolesRepository } from '@/features/users-roles/infrastructure/repositories/usersRoles.repository.impl';

export function fetchPermissionModules(): Promise<Result<readonly PermissionModule[]>> {
  return usersRolesRepository.listPermissionModules();
}
