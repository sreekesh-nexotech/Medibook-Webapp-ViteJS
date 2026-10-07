import type { Page } from '@/core/api/pagination';
import type { Result } from '@/core/error/failure';

import type { OpsAssignableStaff } from '@/features/ops-users/domain/entities/opsUsers.types';
import { opsUsersRepository } from '@/features/ops-users/infrastructure/repositories/opsUsers.repository.impl';

export function fetchAssignableStaff(): Promise<Result<Page<OpsAssignableStaff>>> {
  return opsUsersRepository.listAssignableStaff();
}
