import type { Result } from '@/core/error/failure';

import type { CancelBookingsResult } from '@/features/ops-platform-users/domain/entities/platformUsers.entities';
import { platformUsersRepository } from '@/features/ops-platform-users/infrastructure/repositories/platformUsers.repository.impl';

export function cancelBookings(
  id: string,
  replayKey: string,
): Promise<Result<CancelBookingsResult>> {
  return platformUsersRepository.cancelBookings(id, replayKey);
}
