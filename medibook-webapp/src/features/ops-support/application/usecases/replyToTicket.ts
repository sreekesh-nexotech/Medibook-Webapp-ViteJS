import type { Result } from '@/core/error/failure';

import type {
  TicketMessage,
  TicketReply,
} from '@/features/ops-support/domain/entities/support.entities';
import { supportRepository } from '@/features/ops-support/infrastructure/repositories/support.repository.impl';

export function replyToTicket(id: string, reply: TicketReply): Promise<Result<TicketMessage>> {
  return supportRepository.reply(id, reply);
}
