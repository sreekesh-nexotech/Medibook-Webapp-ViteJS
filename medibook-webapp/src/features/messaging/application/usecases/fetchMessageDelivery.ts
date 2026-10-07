import type { Result } from '@/core/error/failure';

import type { MessageDelivery } from '@/features/messaging/domain/entities/messaging.entities';
import { messagingRepository } from '@/features/messaging/infrastructure/repositories/messaging.repository.impl';

export function fetchMessageDelivery(id: string): Promise<Result<MessageDelivery>> {
  return messagingRepository.getDelivery(id);
}
