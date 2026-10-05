import type { Result } from '@/core/error/failure';

import type {
  DeliveryFilters,
  MessageDelivery,
} from '@/features/messaging/domain/entities/messaging.entities';
import { messagingRepository } from '@/features/messaging/infrastructure/repositories/messaging.repository.impl';

export function exportMessageDeliveries(
  filters: DeliveryFilters,
): Promise<Result<readonly MessageDelivery[]>> {
  return messagingRepository.listAllDeliveries(filters);
}
