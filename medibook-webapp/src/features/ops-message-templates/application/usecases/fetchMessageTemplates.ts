import type { Result } from '@/core/error/failure';

import type { MessageTemplate } from '@/features/ops-message-templates/domain/entities/messageTemplates.entities';
import { messageTemplatesRepository } from '@/features/ops-message-templates/infrastructure/repositories/messageTemplates.repository.impl';

export function fetchMessageTemplates(): Promise<Result<MessageTemplate[]>> {
  return messageTemplatesRepository.listTemplates();
}
