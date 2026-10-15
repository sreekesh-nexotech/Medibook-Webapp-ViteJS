import type { Result } from '@/core/error/failure';

import type {
  MessageTemplate,
  MessageTemplateDraft,
} from '@/features/ops-message-templates/domain/entities/messageTemplates.entities';
import { messageTemplatesRepository } from '@/features/ops-message-templates/infrastructure/repositories/messageTemplates.repository.impl';

/** Create the template (`id` null) or update its wording at `version`. */
export function saveMessageTemplate(
  id: string | null,
  draft: MessageTemplateDraft,
  version: number,
): Promise<Result<MessageTemplate>> {
  return id === null
    ? messageTemplatesRepository.createTemplate(draft)
    : messageTemplatesRepository.updateTemplate(id, draft, version);
}
