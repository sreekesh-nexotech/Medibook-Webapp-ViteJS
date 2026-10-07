import type { Result } from '@/core/error/failure';

import { opsUsersRepository } from '@/features/ops-users/infrastructure/repositories/opsUsers.repository.impl';

export function deleteOpsRole(id: string, version: number): Promise<Result<null>> {
  return opsUsersRepository.deleteRole(id, version);
}
