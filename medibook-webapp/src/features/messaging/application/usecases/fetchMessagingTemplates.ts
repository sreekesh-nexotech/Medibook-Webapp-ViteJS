import type { Result } from '@/core/error/failure';

import type {
  MessagingTemplate,
  PatientChannel,
} from '@/features/messaging/domain/entities/messaging.entities';
import { messagingRepository } from '@/features/messaging/infrastructure/repositories/messaging.repository.impl';

export function fetchMessagingTemplates(
  channel: PatientChannel,
): Promise<Result<readonly MessagingTemplate[]>> {
  return messagingRepository.listTemplates(channel);
}
