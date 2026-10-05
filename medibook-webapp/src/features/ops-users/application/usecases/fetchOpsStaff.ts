import type { Page } from '@/core/api/pagination';
import type { Result } from '@/core/error/failure';

import type { OpsStaffMember } from '@/features/ops-users/domain/entities/opsUsers.types';
import { opsUsersRepository } from '@/features/ops-users/infrastructure/repositories/opsUsers.repository.impl';

export function fetchOpsStaff(): Promise<Result<Page<OpsStaffMember>>> {
  return opsUsersRepository.listStaff();
}
