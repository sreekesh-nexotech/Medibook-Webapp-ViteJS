import type { Result } from '@/core/error/failure';

import type {
  OpsRoleDraft,
  OpsStaffRole,
} from '@/features/ops-users/domain/entities/opsUsers.types';
import { opsUsersRepository } from '@/features/ops-users/infrastructure/repositories/opsUsers.repository.impl';

export function createOpsRole(draft: OpsRoleDraft): Promise<Result<OpsStaffRole>> {
  return opsUsersRepository.createRole(draft);
}
