import type { Result } from '@/core/error/failure';

import { supportRepository } from '@/features/ops-support/infrastructure/repositories/support.repository.impl';

export function fetchTicketAttachmentUrl(fileId: string): Promise<Result<string>> {
  return supportRepository.attachmentUrl(fileId);
}
