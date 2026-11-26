import type { Result } from '@/core/error/failure';

import type { CancelBookingsPreview } from '@/features/ops-platform-users/domain/entities/platformUsers.entities';
import { platformUsersRepository } from '@/features/ops-platform-users/infrastructure/repositories/platformUsers.repository.impl';

export function previewCancelBookings(id: string): Promise<Result<CancelBookingsPreview>> {
  return platformUsersRepository.previewCancelBookings(id);
}
