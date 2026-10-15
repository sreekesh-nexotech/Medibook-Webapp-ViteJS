import type { Result } from '@/core/error/failure';

import { messageTemplatesRepository } from '@/features/ops-message-templates/infrastructure/repositories/messageTemplates.repository.impl';

export function removeMessageTemplate(id: string, version: number): Promise<Result<null>> {
  return messageTemplatesRepository.deleteTemplate(id, version);
}
