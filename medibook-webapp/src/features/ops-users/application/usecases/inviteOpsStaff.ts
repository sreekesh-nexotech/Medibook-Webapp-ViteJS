import type { Result } from '@/core/error/failure';

import type {
  OpsStaffInvite,
  OpsStaffMember,
} from '@/features/ops-users/domain/entities/opsUsers.types';
import { opsUsersRepository } from '@/features/ops-users/infrastructure/repositories/opsUsers.repository.impl';

export function inviteOpsStaff(invite: OpsStaffInvite): Promise<Result<OpsStaffMember>> {
  return opsUsersRepository.inviteStaff(invite);
}
