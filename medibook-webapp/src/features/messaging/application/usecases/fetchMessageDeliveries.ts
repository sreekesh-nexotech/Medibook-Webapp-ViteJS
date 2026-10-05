import type { Page } from '@/core/api/pagination';
import type { Result } from '@/core/error/failure';

import type {
  DeliveryListParams,
  MessageDelivery,
} from '@/features/messaging/domain/entities/messaging.entities';
import { messagingRepository } from '@/features/messaging/infrastructure/repositories/messaging.repository.impl';

export function fetchMessageDeliveries(
  params: DeliveryListParams,
): Promise<Result<Page<MessageDelivery>>> {
  return messagingRepository.listDeliveries(params);
}
