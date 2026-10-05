import type { Result } from '@/core/error/failure';

import type { OpsStaffMember } from '@/features/ops-users/domain/entities/opsUsers.types';
import { opsUsersRepository } from '@/features/ops-users/infrastructure/repositories/opsUsers.repository.impl';

export function unlockOpsStaff(id: string): Promise<Result<OpsStaffMember>> {
  return opsUsersRepository.unlockStaff(id);
}
