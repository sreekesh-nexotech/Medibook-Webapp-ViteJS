import type { Result } from '@/core/error/failure';

import type {
  MessageDelivery,
  MessageSendInput,
} from '@/features/messaging/domain/entities/messaging.entities';
import { messagingRepository } from '@/features/messaging/infrastructure/repositories/messaging.repository.impl';

export function sendMessage(input: MessageSendInput): Promise<Result<readonly MessageDelivery[]>> {
  return messagingRepository.sendMessage(input);
}
