import type { Result } from '@/core/error/failure';

import type {
  NewTicketMessage,
  SupportTicketMessage,
} from '@/features/help/domain/entities/help.types';
import { helpRepository } from '@/features/help/infrastructure/repositories/help.repository.impl';

export function replyToSupportTicket(
  id: string,
  input: NewTicketMessage,
): Promise<Result<SupportTicketMessage>> {
  return helpRepository.addMessage(id, input);
}
